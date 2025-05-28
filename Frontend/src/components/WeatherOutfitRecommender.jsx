import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default markers in react-leaflet
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const WeatherOutfitRecommender = () => {
  const [location, setLocation] = useState('');
  const [coordinates, setCoordinates] = useState({ lat: 6.8213291, lng: 80.0415729 }); 
  const [selectedCoords, setSelectedCoords] = useState(null);
  const [recommendations, setRecommendations] = useState(null);
  const [weatherData, setWeatherData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [inputMethod, setInputMethod] = useState('location'); 

  // Map click handler component
  const MapClickHandler = () => {
    useMapEvents({
      click: (e) => {
        const { lat, lng } = e.latlng;
        setSelectedCoords({ lat, lng });
        setCoordinates({ lat, lng });
      },
    });
    return null;
  };

  const handleLocationSubmit = async () => {
    if (!location.trim() && !selectedCoords) {
      setError('Please enter a location or select a point on the map');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const requestBody = selectedCoords && inputMethod === 'map'
        ? { lat: selectedCoords.lat, lon: selectedCoords.lng, threshold: 0.5 }
        : { location: location.trim(), threshold: 0.5 };

      const response = await fetch('http://localhost:8000/recommend-from-location', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setRecommendations(data.recommendations);
      setWeatherData(data.weather_data);
    } catch (err) {
      setError(`Failed to get recommendations: ${err.message}`);
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getRecommendationIcon = (item) => {
    const icons = {
      'outerwear': '🧥',
      'sweater': '🧶',
      'shorts': '🩳',
      'boots': '🥾',
      'hat': '👒'
    };
    return icons[item] || '👕';
  };

  const getWeatherIcon = (condition) => {
    const icons = {
      'rain': '🌧️',
      'snow': '❄️',
      'cold': '🥶',
      'hot': '🔥',
      'mild': '🌤️'
    };
    return icons[condition] || '☁️';
  };

  const getConfidenceColor = (confidence) => {
    if (confidence >= 0.8) return 'text-green-600';
    if (confidence >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-100 to-blue-200 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            Weather Outfit Recommender
          </h1>
          <p className="text-gray-600">
            Get personalized outfit recommendations based on real-time weather data
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Input Section */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold mb-4 text-gray-800">
              Choose Location
            </h2>
            
            {/* Input Method Toggle */}
            <div className="mb-4">
              <div className="flex space-x-4">
                <button
                  onClick={() => setInputMethod('location')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    inputMethod === 'location'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  📍 Enter Location
                </button>
                <button
                  onClick={() => setInputMethod('map')}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    inputMethod === 'map'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  🗺️ Use Map
                </button>
              </div>
            </div>

            {inputMethod === 'location' ? (
              <div className="mb-4">
                <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-2">
                  Location Name
                </label>
                <input
                  type="text"
                  id="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Enter city, address, or location..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  onKeyPress={(e) => e.key === 'Enter' && handleLocationSubmit()}
                />
              </div>
            ) : (
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  Click on the map to select a location
                </p>
                {selectedCoords && (
                  <div className="text-sm text-blue-600 bg-blue-50 p-2 rounded">
                    Selected: {selectedCoords.lat.toFixed(4)}, {selectedCoords.lng.toFixed(4)}
                  </div>
                )}
              </div>
            )}

            <button
              onClick={handleLocationSubmit}
              disabled={loading || (!location.trim() && !selectedCoords)}
              className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-medium py-3 px-4 rounded-lg transition-colors"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Getting Recommendations...
                </div>
              ) : (
                '🌤️ Get Outfit Recommendations'
              )}
            </button>

            {error && (
              <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded-lg">
                {error}
              </div>
            )}
          </div>

          {/* Map Section */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-xl font-semibold mb-4 text-gray-800">Interactive Map</h3>
            <div className="h-80 rounded-lg overflow-hidden border border-gray-200">
              <MapContainer
                center={[coordinates.lat, coordinates.lng]}
                zoom={10}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <MapClickHandler />
                {selectedCoords && (
                  <Marker position={[selectedCoords.lat, selectedCoords.lng]} />
                )}
              </MapContainer>
            </div>
          </div>
        </div>

        {/* Results Section */}
        {weatherData && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-2xl font-semibold mb-4 text-gray-800 flex items-center">
              <span className="mr-2">{getWeatherIcon(weatherData.condition)}</span>
              Weather Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-medium text-gray-700">Location</h3>
                <p className="text-lg font-semibold text-blue-600">{weatherData.location}</p>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg">
                <h3 className="font-medium text-gray-700">Temperature</h3>
                <p className="text-lg font-semibold text-orange-600">
                  {Math.round(weatherData.temp)}°F ({Math.round(weatherData.temp_c)}°C)
                </p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <h3 className="font-medium text-gray-700">Condition</h3>
                <p className="text-lg font-semibold text-green-600 capitalize">
                  {weatherData.condition_text || weatherData.condition}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div className="bg-purple-50 p-4 rounded-lg">
                <h3 className="font-medium text-gray-700">Season</h3>
                <p className="text-lg font-semibold text-purple-600 capitalize">{weatherData.season}</p>
              </div>
              <div className="bg-teal-50 p-4 rounded-lg">
                <h3 className="font-medium text-gray-700">Humidity</h3>
                <p className="text-lg font-semibold text-teal-600">{weatherData.humidity}%</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-medium text-gray-700">Wind Speed</h3>
                <p className="text-lg font-semibold text-gray-600">{weatherData.wind_kph} km/h</p>
              </div>
            </div>
          </div>
        )}

        {recommendations && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-2xl font-semibold mb-6 text-gray-800">
              👕 Outfit Recommendations
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(recommendations).map(([key, rec]) => (
                <div
                  key={key}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    rec.recommend
                      ? 'border-green-200 bg-green-50'
                      : 'border-gray-200 bg-gray-50'
                  }`}
                >
                  <div className="flex items-center mb-2">
                    <span className="text-2xl mr-3">
                      {getRecommendationIcon(rec.item_name)}
                    </span>
                    <h3 className="font-semibold text-gray-800 capitalize">
                      {rec.item_name}
                    </h3>
                  </div>
                  <div className="mb-2">
                    <span
                      className={`inline-block px-3 py-1 text-sm font-medium rounded-full ${
                        rec.recommend
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {rec.recommend ? '✅ Recommended' : '❌ Not Recommended'}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">Confidence: </span>
                    <span className={`font-bold ${getConfidenceColor(rec.confidence)}`}>
                      {Math.round(rec.confidence * 100)}%
                    </span>
                  </div>
                  {rec.error && (
                    <div className="text-xs text-red-500 mt-1">
                      Error: {rec.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WeatherOutfitRecommender;