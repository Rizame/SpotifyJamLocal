#include <WiFi.h>
#include <ESPAsyncWebServer.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <SPIFFS.h>

const char* ssid = "*";      // wifi login
const char* password = "*";   // pass



const char* clientID = "*"; //unique id from web api dashboard
const char* clientSecret = "*"; //client secret from web api dashboard
const char* redirectURI = "*"; // your redirect uri that you add to web api spotify dashboard


String authURL = "https://accounts.spotify.com/authorize?response_type=code&client_id=" + String(clientID) +
                 "&redirect_uri=" + String(redirectURI) +
                 "&scope=user-modify-playback-state user-read-playback-state user-read-currently-playing";


String accessToken = "";
String refreshToken = "";
unsigned long tokenExpiry = 0;

AsyncWebServer server(80);
bool isGuest = false;
bool isMusicPlaying = false;

String searchSpotify(const String& query);
String searchDevices();
String resumePlayback(const String &deviceID);
String stopPlayback(const String &deviceID);
String enqueueSong(const String& songUri, const String& deviceID);
String skipSong();
String getCurrentSongFromSpotify();


bool isTokenValid() {
  return !accessToken.isEmpty() && millis() < tokenExpiry;
}

void setup() {
  Serial.begin(115200);

  // Initialize SPIFFS
  if (!SPIFFS.begin(true)) {
    Serial.println("SPIFFS initialization failed!");
    return;
  }

  // Connect to Wi-Fi
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.println("Connecting to Wi-Fi...");
  }
  Serial.println("Connected to Wi-Fi");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());


  // Serve the login page if no valid token exists
  server.on("/", HTTP_GET, [](AsyncWebServerRequest* request) {
    if (isGuest || isTokenValid()) {
      request->send(SPIFFS, "/index.html", "text/html");  // Redirect to main content page if token is valid
    } else {
      request->send(SPIFFS, "/login.html", "text/html");  // Serve login page if token is invalid
    }
  });
  server.on("/guest", HTTP_GET, [](AsyncWebServerRequest* request) {
    isGuest = true;
    request->send(SPIFFS, "/index.html", "text/html"); // Serve index.html for guests
  });
  server.on("/styles.css", HTTP_GET, [](AsyncWebServerRequest *request) {
    request->send(SPIFFS, "/styles.css", "text/css");
  });
  server.on("/functionality.js", HTTP_GET, [](AsyncWebServerRequest *request) {
    request->send(SPIFFS, "/functionality.js", "text/js");
  });
  server.on("/search", HTTP_GET, [](AsyncWebServerRequest *request){
    String queryVal = "";
    
    int paramsNr = request->params();
    for (int i = 0; i < paramsNr; i++)
    {
      const AsyncWebParameter* p = request->getParam(i);
      if(p->name() == "query"){
        queryVal = p->value();
        break;
      }
    }
    
    Serial.println("Received query: " + queryVal);

    String result = searchSpotify(queryVal);  

    request->send(200, "application/json", result);
  });

  server.on("/togglePlayback", HTTP_GET, [](AsyncWebServerRequest *request){
    String deviceID = "";
    
    
    int paramsNr = request->params();
    for (int i = 0; i < paramsNr; i++)
    {
      const AsyncWebParameter* p = request->getParam(i);
      if(p->name() == "deviceID"){
        deviceID = p->value();
      }
      else if (p->name() == "isPlaying") {
        String value = p->value();
        isMusicPlaying = (value == "true" || value == "1");
        break;
      }
    }
    
    Serial.println("Received ID: " + deviceID);

    String result;
    if(isMusicPlaying){
      result = resumePlayback(deviceID);  
    }
    else result = stopPlayback(deviceID);  


    String jsonResponse = "{\"status\": \"" + result + "\"}";
    request->send(200, "application/json", jsonResponse);
  });

  server.on("/queueSong", HTTP_GET, [](AsyncWebServerRequest *request){
    String songUri = "";
    String deviceID = "";
    
    
    int paramsNr = request->params();
    for (int i = 0; i < paramsNr; i++)
    {
      const AsyncWebParameter* p = request->getParam(i);
      if(p->name() == "songUri"){
        songUri = p->value();
      }
      else if(p->name() == "deviceID"){
        deviceID = p->value();
        break;
      }
    }
    
    Serial.println("Received uri: " + songUri);

    String result = enqueueSong(songUri, deviceID); 


    String jsonResponse = "{\"status\": \"" + result + "\"}";
    request->send(200, "application/json", jsonResponse);
  });
  server.on("/skipSong", HTTP_GET, [](AsyncWebServerRequest *request){
    String result = skipSong(); 
    String jsonResponse = "{\"status\": \"" + result + "\"}";
    request->send(200, "application/json", jsonResponse);
  });
  server.on("/currentlyPlaying", HTTP_GET, [](AsyncWebServerRequest *request) {
    String result = getCurrentSongFromSpotify();
    if(result == "EMPTY_RESPONSE"){
      String jsonResponse = "{\"status\": \"" + result + "\"}";
      request->send(200, "application/json", jsonResponse);
    }
    else request->send(200, "application/json", result);
  });


server.on("/device", HTTP_GET, [](AsyncWebServerRequest *request) {
    String result = searchDevices();
    request->send(200, "application/json", result);
  });

  // Callback route for Spotify login
  server.on("/callback", HTTP_GET, [](AsyncWebServerRequest* request) {
    if (request->hasParam("code")) {
      String code = request->getParam("code")->value();
      HTTPClient http;
      http.begin("https://accounts.spotify.com/api/token");
      http.addHeader("Content-Type", "application/x-www-form-urlencoded");

      String postData = "grant_type=authorization_code"
                        "&code=" + code +
                        "&redirect_uri=" + String(redirectURI) +
                        "&client_id=" + String(clientID) +
                        "&client_secret=" + String(clientSecret);

      int httpCode = http.POST(postData);
      if (httpCode == HTTP_CODE_OK) {
        String payload = http.getString();
        DynamicJsonDocument doc(1024);
        deserializeJson(doc, payload);
        accessToken = doc["access_token"].as<String>();
        Serial.println(accessToken);
        refreshToken = doc["refresh_token"].as<String>();
        int expiresIn = doc["expires_in"].as<int>();
        tokenExpiry = millis() + expiresIn * 1000; // Update the token expiry time

        request->send(SPIFFS, "/index.html", "text/html");
      } else {
        request->send(400, "text/html", "<html><body><h2>Error during authorization</h2></body></html>");
      }
      http.end();
    } else {
      request->send(400, "text/html", "<html><body><h2>No authorization code provided</h2></body></html>");
    }
  });


  // Start the server
  server.begin();
}
String urlEncode(const String& str) {
  String encodedString = "";

  for (unsigned int i = 0; i < str.length(); i++) {
    char c = str.charAt(i);
    if (isalnum(c) || c == '-' || c == '_' || c == '.' || c == '~') {
      encodedString += c;  // These characters are not encoded
    } else {
      // Convert non-safe characters to %XX form
      encodedString += '%';
      encodedString += String(c, HEX);  // Convert char to hex
    }
  }

  return encodedString;
}
String searchSpotify(const String& query) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;

    String url = "https://api.spotify.com/v1/search?q=" + urlEncode(query) + "&type=track&limit=5";
    
    // Make the request to the Spotify API
    Serial.println("api call: " + url);
    http.begin(url);  
    http.addHeader("Authorization", "Bearer " + accessToken);  // Add the access token for authorization

    int httpCode = http.GET();

    String payload = http.getString();
    http.end(); 
    return payload;

    
  }
}

String searchDevices() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;

    String url = "https://api.spotify.com/v1/me/player/devices";
    http.begin(url);

    // Check token validity before making the request
    if (!isTokenValid()) {
      Serial.println("Invalid token");
      return "";
    }

    // Add the Authorization header with the Bearer token
    http.addHeader("Authorization", "Bearer " + accessToken); 

    // Make the GET request
    int httpCode = http.GET();

    if (httpCode == HTTP_CODE_OK) {
      // Successfully fetched the devices
      String payload = http.getString();

      // Deserialize the JSON response
      DynamicJsonDocument doc(1024);
      DeserializationError error = deserializeJson(doc, payload);

      http.end();  
      if (error) {
        Serial.println("Failed to deserialize JSON: " + String(error.c_str()));
        return "";
      }

      Serial.println("Devices fetched successfully");
      return payload; // Return the raw JSON or you can parse it further

    }
    else {
      // Handle the error if the request fails
      Serial.println("Error in HTTP request, code: " + String(httpCode));
    }

    // End the HTTP request
    http.end();  

  } else {
    Serial.println("WiFi not connected");
  }

  return "";
}

String resumePlayback(const String& deviceID) {
  if(WiFi.status() != WL_CONNECTED) return "WiFi disconnected";

  HTTPClient http;

  Serial.println("PLAYING!!!");
  http.begin("https://api.spotify.com/v1/me/player/play?device_id=" + deviceID);
  
  // REQUIRED HEADERS
  http.addHeader("Authorization", "Bearer " + accessToken);
  http.addHeader("Content-Length", "0"); 

  int httpCode = http.PUT("");
  String response = http.getString();
  http.end();

  Serial.print("HTTP Code: ");
  Serial.println(httpCode);

  return (httpCode == 200) ? "success" : "HTTP Error " + String(httpCode);
}

String stopPlayback(const String& deviceID) {
  if(WiFi.status() != WL_CONNECTED) return "WiFi disconnected";

  HTTPClient http;

  Serial.println("PAUSIN!!!");
  http.begin("https://api.spotify.com/v1/me/player/pause?device_id=" + deviceID);
  
  // REQUIRED HEADERS
  http.addHeader("Authorization", "Bearer " + accessToken);
  http.addHeader("Content-Length", "0"); 

  int httpCode = http.PUT("");
  String response = http.getString();
  http.end();

  Serial.print("HTTP Code: ");
  Serial.println(httpCode);

  return (httpCode == 200) ? "success" : "HTTP Error " + String(httpCode);
}

String enqueueSong(const String& songUri, const String& deviceID) {  
  if(WiFi.status() != WL_CONNECTED) return "WiFi disconnected";

  HTTPClient http;
  Serial.println("Queueing song: " + songUri);


  String url = "https://api.spotify.com/v1/me/player/queue?uri=" + songUri + "&device_id=" + deviceID;
  http.begin(url);
  http.addHeader("Authorization", "Bearer " + accessToken);
  http.addHeader("Content-Length", "0"); 

  int httpCode = http.POST("");  
  http.end();

  Serial.print("HTTP Code: ");
  Serial.println(httpCode);

  // 204 means success, no content returned
  return (httpCode == 200) ? "success" : "HTTP Error " + String(httpCode);
}

String skipSong() {  
  if(WiFi.status() != WL_CONNECTED) return "WiFi disconnected";

  HTTPClient http;
  Serial.println("skipping song: ");
  
  String url = "https://api.spotify.com/v1/me/player/next";
  http.begin(url);
  http.addHeader("Authorization", "Bearer " + accessToken);
  http.addHeader("Content-Length", "0"); 

  int httpCode = http.POST("");  
  http.end();

  Serial.print("HTTP Code: ");
  Serial.println(httpCode);

  // 204 means success, no content returned
  return (httpCode == 200) ? "success" : "HTTP Error " + String(httpCode);
}

String getCurrentSongFromSpotify() {
  if (WiFi.status() != WL_CONNECTED) return "WiFi disconnected";
  HTTPClient http;
  String url = "https://api.spotify.com/v1/me/player/currently-playing?market=UA";

  http.begin(url);  
  http.addHeader("Authorization", "Bearer " + accessToken);

  int httpCode = http.GET();
  if (httpCode == HTTP_CODE_OK) {
    String payload = http.getString();
    http.end();

    if (payload.length() == 0) {
      return "EMPTY_RESPONSE";
    }

    return payload;
  }

  // If Spotify returns 204 (no content) or error
  http.end();
  return "EMPTY_RESPONSE";
}



void loop() {
  
}