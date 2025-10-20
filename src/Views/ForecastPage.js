import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, useLocation } from 'react-router-dom';
import '../styles/ForecastPage.css';

// Sidebar Component (similar to Weather Dashboard)
function Sidebar({ onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();

  const links = [
    { name: "Weather", path: "/dashboard" },
    { name: "Forecast", path: "/forecast" },
    { name: "Alerts", path: "/alerts" },
    { name: "Profile", path: "/profile" },
    { name: "Subscription", path: "/subscriptions" },
    { name: "Locations", path: "/locations" },
  ];

  return (
    <aside className="sidebar">
      <h2 className="sidebar-logo">WeatherPro</h2>
      <p className="sidebar-subtitle">Advanced Weather</p>
      <ul className="sidebar-links">
        {links.map((link) => (
          <li
            key={link.path}
            className={location.pathname === link.path ? "active" : ""}
            onClick={() => navigate(link.path)}
          >
            {link.name}
          </li>
        ))}
      </ul>
      <div className="sidebar-footer">
        <button onClick={onLogout}>Sign Out</button>
      </div>
    </aside>
  );
}

const Forecast = () => {
  const [city, setCity] = useState('');
  const [countryCode, setCountryCode] = useState('');
  const [forecastData, setForecastData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [recentSearches, setRecentSearches] = useState([]);
  const [selectedDay, setSelectedDay] = useState('all');
  const [userProfile, setUserProfile] = useState(null);
  
  const navigate = useNavigate();
  const location = useLocation();

  // Get user profile from localStorage
  const getUserProfile = () => {
    const profile = localStorage.getItem('userProfile');
    return profile ? JSON.parse(profile) : null;
  };

  // Check if user is authenticated and get profile
  useEffect(() => {
    const profile = getUserProfile();
    setUserProfile(profile);
    
    if (!profile) {
      navigate('/login');
    }
  }, [navigate]);

  // Configure axios interceptor to include token in requests
  useEffect(() => {
    const interceptor = axios.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('jwtToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.request.eject(interceptor);
    };
  }, []);

  // Handle axios errors
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          handleLogout();
          setError('Your session has expired. Please log in again.');
        } else if (error.response?.status === 403) {
          setError('Access denied. You do not have permission to perform this action.');
        }
        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, []);

  useEffect(() => {
    const savedSearches = localStorage.getItem('recentWeatherSearches');
    if (savedSearches) {
      setRecentSearches(JSON.parse(savedSearches));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('recentWeatherSearches', JSON.stringify(recentSearches));
  }, [recentSearches]);

  const handleSearch = async (e) => {
    e.preventDefault();
    
    if (!userProfile) {
      setError('Please log in to access weather forecasts');
      return;
    }

    if (!city.trim()) {
      setError('Please enter a city name');
      return;
    }
   
    setLoading(true);
    setError('');
    setForecastData(null);
    setSelectedDay('all');
   
    try {
      console.log('Searching for 5-day forecast:', city, countryCode);
     
      // First, try to get existing data from our database
      try {
        const response = await axios.get(
          `http://localhost:8080/api/forecast/city/${encodeURIComponent(city)}/country/${countryCode || 'ZA'}`
        );
       
        if (response.data && response.data.length > 0) {
          console.log('Found existing data in database:', response.data.length, 'entries');
          setForecastData(response.data);
          addToRecentSearches(city, countryCode);
          return;
        }
      } catch (getError) {
        if (getError.response?.status === 404) {
          console.log('No existing data found, will fetch from API');
        } else {
          throw getError;
        }
      }
     
      // If no existing data, fetch from OpenWeatherMap API
      console.log('Fetching 5-day forecast from OpenWeatherMap API...');
      const createResponse = await axios.post(
        `http://localhost:8080/api/forecast/fetch/${encodeURIComponent(city)}/${countryCode || 'ZA'}`
      );
     
      if (createResponse.data && createResponse.data.length > 0) {
        console.log('5-day forecast fetched from API successfully:', createResponse.data.length, 'entries');
       
        // Now get the saved data from our database
        const response = await axios.get(
          `http://localhost:8080/api/forecast/city/${encodeURIComponent(city)}/country/${countryCode || 'ZA'}`
        );
       
        if (response.data && response.data.length > 0) {
          setForecastData(response.data);
          addToRecentSearches(city, countryCode);
        } else {
          setError('No forecast data found for this location.');
        }
      } else {
        setError('Failed to fetch 5-day forecast data.');
      }
    } catch (err) {
      console.error('Error fetching forecast:', err);
      if (err.response?.status === 403) {
        setError('You do not have permission to fetch new weather data. Please contact an administrator.');
      } else if (err.response?.status === 401) {
        setError('Please log in to access weather forecasts');
      } else if (err.response?.data) {
        setError(err.response.data);
      } else {
        setError('Failed to fetch weather data. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('jwtToken');
    localStorage.removeItem('userProfile');
    navigate('/');
  };

  // Helper functions (keep all your existing helper functions)
  const groupForecastsByDay = (forecasts) => {
    if (!forecasts) return {};
   
    const grouped = {};
    forecasts.forEach(forecast => {
      const date = new Date(forecast.forecastTime).toDateString();
      if (!grouped[date]) {
        grouped[date] = [];
      }
      grouped[date].push(forecast);
    });
   
    return grouped;
  };

  const getFilteredForecasts = () => {
    if (!forecastData) return [];
   
    if (selectedDay === 'all') {
      return forecastData;
    }
   
    return forecastData.filter(forecast => {
      const forecastDate = new Date(forecast.forecastTime).toDateString();
      return forecastDate === selectedDay;
    });
  };

  const getAvailableDays = () => {
    if (!forecastData) return [];
   
    const days = {};
    forecastData.forEach(forecast => {
      const date = new Date(forecast.forecastTime).toDateString();
      days[date] = true;
    });
   
    return Object.keys(days);
  };

  const addToRecentSearches = (city, countryCode) => {
    const searchTerm = countryCode ? `${city}, ${countryCode}` : city;
    if (!recentSearches.includes(searchTerm)) {
      const updatedSearches = [searchTerm, ...recentSearches.slice(0, 4)];
      setRecentSearches(updatedSearches);
    }
  };

  const handleRecentSearch = (searchTerm) => {
    if (!userProfile) {
      setError('Please log in to access weather forecasts');
      return;
    }

    const parts = searchTerm.split(', ');
    setCity(parts[0]);
    if (parts.length > 1) {
      setCountryCode(parts[1]);
    } else {
      setCountryCode('ZA');
    }
  };

  const formatDate = (dateString) => {
    try {
      const options = {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      };
      return new Date(dateString).toLocaleDateString('en-US', options);
    } catch (error) {
      return dateString;
    }
  };

  const formatDay = (dateString) => {
    try {
      const options = { weekday: 'long', month: 'long', day: 'numeric' };
      return new Date(dateString).toLocaleDateString('en-US', options);
    } catch (error) {
      return dateString;
    }
  };

  const getWeatherIcon = (condition) => {
    if (!condition) return '🌤';
   
    const conditionMap = {
      'clear': '☀', 'clouds': '☁', 'rain': '🌧', 'drizzle': '🌦',
      'thunderstorm': '⛈', 'snow': '❄', 'mist': '🌫', 'smoke': '🌫',
      'haze': '🌫', 'dust': '🌫', 'fog': '🌫', 'sand': '🌫',
      'ash': '🌫', 'squall': '💨', 'tornado': '🌪'
    };
   
    const lowerCondition = condition.toLowerCase();
    for (const key in conditionMap) {
      if (lowerCondition.includes(key)) {
        return conditionMap[key];
      }
    }
    return '🌤';
  };

  const filteredForecasts = getFilteredForecasts();
  const availableDays = getAvailableDays();
  const forecastsByDay = groupForecastsByDay(forecastData);

  // Get user first name for welcome message
  const firstName = userProfile?.firstName || userProfile?.username || 'User';

  return (
    <div className="dashboard-container">
      <Sidebar onLogout={handleLogout} />
      
      <main className="main-content">
        <section className="search-section">
          <h1>5-Day Weather Forecast</h1>
          <p>
            Welcome, <strong>{firstName}</strong>! Get detailed 5-day weather forecasts for any location worldwide.
            {userProfile?.role === 'ADMIN' && ' (Admin Mode)'}
          </p>
          
          <form onSubmit={handleSearch} className="search-form">
            <div className="search-bar">
              <input
                type="text"
                placeholder="Enter city name (e.g., Cape Town, London, Tokyo)"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                required
                disabled={loading}
              />
              <input
                type="text"
                placeholder="Country code (ZA, US, GB)"
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value.toUpperCase())}
                style={{ width: '120px' }}
                disabled={loading}
              />
              <button 
                type="submit" 
                disabled={loading || !city.trim()}
                className="search-btn"
              >
                {loading ? '⏳ Loading...' : '🔍 '}
              </button>
            </div>
          </form>

          {/* Recent Searches */}
          {recentSearches.length > 0 && (
            <div className="recent-searches">
              <h3>Recent Searches</h3>
              <ul>
                {recentSearches.map((searchTerm, index) => (
                  <li key={index} onClick={() => handleRecentSearch(searchTerm)}>
                    {searchTerm}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Error messages */}
        {error && (
          <div className={`error-message ${error.includes('logged out') ? 'info-message' : ''}`}>
            <div className="error-content">
              <span className="error-icon">⚠️</span>
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Day selection filter */}
        {forecastData && forecastData.length > 0 && (
          <div className="day-filter-section">
            <h3>📅 Filter by Day</h3>
            <div className="day-buttons">
              <button
                className={`day-btn ${selectedDay === 'all' ? 'active' : ''}`}
                onClick={() => setSelectedDay('all')}
              >
                📊 All Days
              </button>
              {availableDays.map((day, index) => (
                <button
                  key={index}
                  className={`day-btn ${selectedDay === day ? 'active' : ''}`}
                  onClick={() => setSelectedDay(day)}
                >
                  {formatDay(day)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Forecast display */}
        {filteredForecasts && filteredForecasts.length > 0 && (
          <div className="forecast-results">
            <div className="results-header">
              <h2>
                {getWeatherIcon(filteredForecasts[0].condition)} 
                5-Day Forecast for <b>{filteredForecasts[0].city}</b>
              </h2>
              <div className="results-count">
                {filteredForecasts.length} forecast{filteredForecasts.length !== 1 ? 's' : ''} shown
              </div>
            </div>
           
            {selectedDay === 'all' ? (
              // Show grouped by day in grid layout
              <div className="forecast-grid-container">
                {Object.entries(forecastsByDay).map(([day, dayForecasts]) => (
                  <div key={day} className="day-section">
                    <h3 className="day-header">{formatDay(day)}</h3>
                    <div className="forecast-grid">
                      {dayForecasts.map((forecast, index) => (
                        <div key={index} className="forecast-card">
                          <div className="card-header">
                            <div className="time-badge">
                              {new Date(forecast.forecastTime).toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: true
                              })}
                            </div>
                            <div className="weather-icon-large">
                              {getWeatherIcon(forecast.condition)}
                            </div>
                          </div>
                          
                          <div className="temperature-section">
                            <div className="main-temp">
                              {Math.round(forecast.temperature)}°C
                            </div>
                            <div className="feels-like">
                              Feels like {Math.round(forecast.feelsLike)}°C
                            </div>
                          </div>

                          <div className="weather-condition">
                            <div className="condition">{forecast.condition}</div>
                            <div className="description">{forecast.description}</div>
                          </div>

                          <div className="weather-details-grid">
                            <div className="detail-item">
                              <span className="detail-icon">⬇️</span>
                              <span className="detail-label">Min</span>
                              <span className="detail-value">{Math.round(forecast.minTemperature)}°C</span>
                            </div>
                            <div className="detail-item">
                              <span className="detail-icon">⬆️</span>
                              <span className="detail-label">Max</span>
                              <span className="detail-value">{Math.round(forecast.maxTemperature)}°C</span>
                            </div>
                            <div className="detail-item">
                              <span className="detail-icon">💧</span>
                              <span className="detail-label">Humidity</span>
                              <span className="detail-value">{forecast.humidity}%</span>
                            </div>
                            <div className="detail-item">
                              <span className="detail-icon">💨</span>
                              <span className="detail-label">Wind</span>
                              <span className="detail-value">{forecast.windSpeed} m/s</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              // Show single day in detailed grid
              <div className="forecast-grid detailed-view">
                {filteredForecasts.map((forecast, index) => (
                  <div key={index} className="forecast-card detailed-card">
                    <div className="card-header">
                      <div className="time-section">
                        <div className="time-badge large">
                          {new Date(forecast.forecastTime).toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true
                          })}
                        </div>
                        <div className="date-small">
                          {new Date(forecast.forecastTime).toLocaleDateString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </div>
                      </div>
                      <div className="weather-icon-xlarge">
                        {getWeatherIcon(forecast.condition)}
                      </div>
                    </div>
                    
                    <div className="temperature-section">
                      <div className="main-temp large">
                        {Math.round(forecast.temperature)}°C
                      </div>
                      <div className="temp-range">
                        <span className="temp-min">L: {Math.round(forecast.minTemperature)}°C</span>
                        <span className="temp-max">H: {Math.round(forecast.maxTemperature)}°C</span>
                      </div>
                      <div className="feels-like">
                        Feels like {Math.round(forecast.feelsLike)}°C
                      </div>
                    </div>

                    <div className="weather-condition">
                      <div className="condition main">{forecast.condition}</div>
                      <div className="description">{forecast.description}</div>
                    </div>

                    <div className="weather-details-grid expanded">
                      <div className="detail-row">
                        <div className="detail-item expanded">
                          <span className="detail-icon">💧</span>
                          <div className="detail-info">
                            <span className="detail-label">Humidity</span>
                            <span className="detail-value">{forecast.humidity}%</span>
                          </div>
                        </div>
                        <div className="detail-item expanded">
                          <span className="detail-icon">📊</span>
                          <div className="detail-info">
                            <span className="detail-label">Pressure</span>
                            <span className="detail-value">{forecast.pressure} hPa</span>
                          </div>
                        </div>
                      </div>
                      <div className="detail-row">
                        <div className="detail-item expanded">
                          <span className="detail-icon">💨</span>
                          <div className="detail-info">
                            <span className="detail-label">Wind Speed</span>
                            <span className="detail-value">{forecast.windSpeed} m/s</span>
                          </div>
                        </div>
                        <div className="detail-item expanded">
                          <span className="detail-icon">🧭</span>
                          <div className="detail-info">
                            <span className="detail-label">Wind Direction</span>
                            <span className="detail-value">{forecast.windDirection}°</span>
                          </div>
                        </div>
                      </div>
                      <div className="detail-row">
                        <div className="detail-item expanded">
                          <span className="detail-icon">👁️</span>
                          <div className="detail-info">
                            <span className="detail-label">Visibility</span>
                            <span className="detail-value">{forecast.visibility / 1000} km</span>
                          </div>
                        </div>
                        <div className="detail-item expanded">
                          <span className="detail-icon">☁️</span>
                          <div className="detail-info">
                            <span className="detail-label">Cloudiness</span>
                            <span className="detail-value">{forecast.cloudiness}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {loading && (
          <div className="loading-overlay">
            <div className="loading-spinner"></div>
            <p>Fetching weather data...</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default Forecast;