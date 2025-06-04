from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import joblib
import pandas as pd
import numpy as np
from typing import Dict, Any
import os
import requests
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Weather Outfit Recommender API",
             description="API for recommending outfits based on weather conditions",
             version="1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

try:
    with open('models/features.txt', 'r') as f:
        FEATURES = f.read().splitlines()
except FileNotFoundError:
    FEATURES = [
        'temperature', 'season_fall', 'season_spring', 'season_summer', 
        'season_winter', 'condition_cold', 'condition_hot', 'condition_rain', 'condition_snow'
    ]

MODELS = {}
for target in ['needs_outerwear', 'item_sweater', 'item_shorts', 'item_boots', 'item_hat']:
    try:
        model_path = f"models/{target}_model.joblib"
        scaler_path = f"models/{target}_scaler.joblib"
        
        if os.path.exists(model_path) and os.path.exists(scaler_path):
            MODELS[target] = {
                'model': joblib.load(model_path),
                'scaler': joblib.load(scaler_path)
            }
        else:
            print(f"Warning: Model files for {target} not found. Using fallback logic.")
    except Exception as e:
        print(f"Warning: Error loading {target} model: {str(e)}")

# Request models
class WeatherRequest(BaseModel):
    temperature: float
    season: str  # 'winter', 'spring', 'summer', 'fall'
    condition: str  # 'cold', 'hot', 'rain', 'snow'
    threshold: float = 0.5  # Confidence threshold

class LocationRequest(BaseModel):
    location: str = None
    lat: float = None
    lon: float = None
    threshold: float = 0.5

# Response model
class RecommendationResponse(BaseModel):
    recommendations: Dict[str, Dict[str, Any]]
    weather_data: Dict[str, Any]

@app.get("/")
async def root():
    return {"message": "Weather Outfit Recommender API"}

@app.post("/recommend", response_model=RecommendationResponse)
async def get_recommendation(request: WeatherRequest):
    """Get outfit recommendations based on direct weather input"""
    try:
        recommendations = generate_recommendations(
            request.temperature,
            request.season,
            request.condition,
            request.threshold
        )
        
        return {
            "recommendations": recommendations,
            "weather_data": {
                "temperature": request.temperature,
                "season": request.season,
                "condition": request.condition
            }
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/recommend-from-location", response_model=RecommendationResponse)
async def recommend_from_location(request: LocationRequest):
    """Get recommendations based on location (uses weather API)"""
    try:
        # Determine location query
        if request.lat is not None and request.lon is not None:
            location_query = f"{request.lat},{request.lon}"
        elif request.location:
            location_query = request.location
        else:
            raise ValueError("Either location name or coordinates (lat, lon) must be provided")
        
        weather_data = get_weather_data(location_query)
        recommendations = generate_recommendations(
            weather_data['temp'],
            weather_data['season'],
            weather_data['condition'],
            request.threshold
        )
        
        return {
            "recommendations": recommendations,
            "weather_data": weather_data
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

def generate_recommendations(temp: float, season: str, condition: str, threshold: float) -> Dict:
    """Core recommendation logic"""
    recommendations = {}
    
    # If models are available, use them
    if MODELS:
        # Prepare input features
        input_features = pd.DataFrame([[
            temp,
            season == 'fall',
            season == 'spring',
            season == 'summer',
            season == 'winter',
            condition == 'cold',
            condition == 'hot',
            condition == 'rain',
            condition == 'snow'
        ]], columns=FEATURES)

        for target, assets in MODELS.items():
            try:
                # Scale features
                scaled_features = assets['scaler'].transform(input_features)
                
                # Predict
                proba = assets['model'].predict_proba(scaled_features)[0][1]
                
                recommendations[target] = {
                    "recommend": bool(proba > threshold),
                    "confidence": float(proba),
                    "item_name": target.replace('_', ' ').replace('item ', '').replace('needs ', '')
                }
            except Exception as e:
                recommendations[target] = {
                    "error": str(e),
                    "recommend": False,
                    "confidence": 0.0,
                    "item_name": target.replace('_', ' ').replace('item ', '').replace('needs ', '')
                }
    else:
        # Fallback logic when models are not available
        recommendations = generate_fallback_recommendations(temp, season, condition)
    
    return recommendations

def generate_fallback_recommendations(temp: float, season: str, condition: str) -> Dict:
    """Fallback recommendation logic when ML models are not available"""
    recommendations = {}
    
    # Temperature in Celsius for calculations
    temp_c = (temp - 32) * 5/9 if temp > 50 else temp  
    
    # Outerwear recommendation
    outerwear_needed = temp_c < 15 or condition in ['rain', 'snow', 'cold']
    recommendations['needs_outerwear'] = {
        "recommend": outerwear_needed,
        "confidence": 0.9 if outerwear_needed else 0.1,
        "item_name": "outerwear"
    }
    
    # Sweater recommendation
    sweater_needed = temp_c < 20 or season in ['winter', 'fall']
    recommendations['item_sweater'] = {
        "recommend": sweater_needed,
        "confidence": 0.8 if sweater_needed else 0.2,
        "item_name": "sweater"
    }
    
    # Shorts recommendation
    shorts_recommended = temp_c > 22 and condition not in ['rain', 'snow']
    recommendations['item_shorts'] = {
        "recommend": shorts_recommended,
        "confidence": 0.8 if shorts_recommended else 0.3,
        "item_name": "shorts"
    }
    
    # Boots recommendation
    boots_needed = condition in ['rain', 'snow'] or temp_c < 5
    recommendations['item_boots'] = {
        "recommend": boots_needed,
        "confidence": 0.9 if boots_needed else 0.2,
        "item_name": "boots"
    }
    
    # Hat recommendation
    hat_needed = temp_c < 10 or condition in ['snow', 'cold'] or season == 'winter'
    recommendations['item_hat'] = {
        "recommend": hat_needed,
        "confidence": 0.7 if hat_needed else 0.3,
        "item_name": "hat"
    }
    
    return recommendations

def get_weather_data(location_query: str) -> Dict:
    """
    Fetch weather data from WeatherAPI
    
    Args:
        location_query: Location string (city name, coordinates, etc.)
    
    Returns:
        Dict containing processed weather data for outfit recommendations
    """
    try:
        # Get weather data from API
        weather_api_url = os.getenv("WEATHER_API_URL")
        api_key = os.getenv("WEATHER_API_KEY")
        
        if not api_key:
            print("Warning: Weather API key not found. Using mock data.")
            return get_mock_weather_data(location_query)
        
        # Make API request
        params = {
            "key": api_key,
            "q": location_query,
            "aqi": "no"
        }
        
        response = requests.get(weather_api_url, params=params, timeout=10)
        
        if response.status_code != 200:
            print(f"Weather API error: {response.status_code}. Using mock data.")
            return get_mock_weather_data(location_query)
        
        try:
            data = response.json()
        except requests.exceptions.JSONDecodeError as e:
            print(f"JSON decode error: {e}. Using mock data.")
            return get_mock_weather_data(location_query)
        
        # Extract current weather data
        current_data = data.get("current", {})
        location_data = data.get("location", {})
        
        if not current_data:
            print("No current weather data found. Using mock data.")
            return get_mock_weather_data(location_query)
        
        # Process weather data for outfit recommendations
        temp_c = current_data.get("temp_c", 20)
        temp_f = current_data.get("temp_f", 68)
        condition_text = current_data.get("condition", {}).get("text", "").lower()
        humidity = current_data.get("humidity", 50)
        wind_kph = current_data.get("wind_kph", 0)
        
        # Determine season based on current date and hemisphere
        season = determine_season()
        
        # Determine weather condition for outfit recommendation
        condition = determine_weather_condition(temp_c, condition_text, humidity)
        
        return {
            "temp": temp_f,
            "temp_c": temp_c,
            "season": season,
            "condition": condition,
            "humidity": humidity,
            "wind_kph": wind_kph,
            "condition_text": condition_text,
            "location": f"{location_data.get('name', location_query)}, {location_data.get('country', '')}",
            "last_updated": current_data.get("last_updated", "")
        }
        
    except Exception as e:
        print(f"Error fetching weather data: {e}. Using mock data.")
        return get_mock_weather_data(location_query)

def get_mock_weather_data(location_query: str) -> Dict:
    """Return mock weather data when API is unavailable"""
    return {
        "temp": 66.0,
        "temp_c": 19.0,
        "season": determine_season(),
        "condition": "mild",
        "humidity": 56,
        "wind_kph": 20,
        "condition_text": "partly cloudy",
        "location": location_query,
        "last_updated": datetime.now().isoformat(),
        "mock_data": True
    }

def determine_season() -> str:
    """Determine season based on current date (Northern Hemisphere)"""
    current_month = datetime.now().month
    if current_month in [12, 1, 2]:
        return "winter"
    elif current_month in [3, 4, 5]:
        return "spring"
    elif current_month in [6, 7, 8]:
        return "summer"
    else:
        return "fall"

def determine_weather_condition(temp_c: float, condition_text: str, humidity: float) -> str:
    """
    Determine simplified weather condition for outfit recommendations
    """
    condition_lower = condition_text.lower()
    
    # Check for precipitation first
    if any(word in condition_lower for word in ['rain', 'drizzle', 'shower']):
        return "rain"
    elif any(word in condition_lower for word in ['snow', 'blizzard', 'sleet']):
        return "snow"
    
    # Temperature-based conditions
    if temp_c <= 10: 
        return "cold"
    elif temp_c >= 27:  
        return "hot"
    else:
        return "mild"

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)