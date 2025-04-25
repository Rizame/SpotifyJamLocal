let songs = []; // This will hold your entire playlist data
let currentPage = 1;
let selectedDevice;
let isMatchingList = false;

let progressTimeout = null;
let progressUpdater = null;

const songsPerPage = 5;



const firebaseConfig = {
//personal firebase config must be there
};



const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();



function msToTime(ms) {
  const minutes = Math.floor(ms / 60000); // 60000 ms in a minute
  const seconds = Math.floor((ms % 60000) / 1000); // remainder is seconds

  // Format minutes and seconds to ensure two digits
  const formattedMinutes = minutes < 10 ? '0' + minutes : minutes;
  const formattedSeconds = seconds < 10 ? '0' + seconds : seconds;

  return `${formattedMinutes}:${formattedSeconds}`;
}

function getTracksFromDatabase() {
  const tracksCollection = db.collection('playlist');

  tracksCollection
    .orderBy('createdAt', 'asc') 
    .get()
    .then((querySnapshot) => {
      songs = [];

      querySnapshot.forEach((doc) => {
        const track = doc.data();
        songs.push(track); // Add track data to the songs array
      });

      displaySongs();
    })
    .catch((error) => {
      console.error('Error getting tracks: ', error);
    });
}

// Function to display songs for the current page
function displaySongs() {
  const songList = document.getElementById("song-list");
  songList.innerHTML = ""; // Clear the list before adding new songs

  // Calculate which songs to show for the current page
  const startIndex = (currentPage - 1) * songsPerPage;
  const endIndex = startIndex + songsPerPage;
  const currentSongs = songs.slice(startIndex, endIndex);

  songList.classList.add("max-w-4xl"); // max width and center 

  // Add songs to the page
  currentSongs.forEach(song => {
    const songDiv = document.createElement("div");
  
    // Adding Tailwind CSS classes for hover effects, shadow, and cursor pointer
    songDiv.classList.add(
      "song-item",
      "bg-white",
      "p-4",
      "rounded-lg",  // Rounded corners for a nice card effect
      "shadow-md",   // Small shadow to give a 3D effect
      "hover:shadow-lg",  // Larger shadow on hover
      "hover:bg-gray-100", // Change background color on hover
      "cursor-pointer", // Change mouse cursor to pointer on hover
      "transition-all", // Smooth transition for the hover effect
      "duration-200", // Smooth animation timing
      "flex",         // Keeps the content inside aligned
      "w-4/4",        
    );
  
    songDiv.innerHTML = `
  <div class="flex flex-col">
    <img src="${song.albumArt}" style="width: 64px; height: 64px; image-rendering: crisp-edges;" class="mb-2 rounded-lg object-cover">
    <span class="font-semibold text-lg">${song.title}</span>
    <span class="text-gray-600 text-sm">${song.artist}</span>
    <span class="text-gray-400 text-xs">${song.duration}</span>
  </div>`

  
    songList.appendChild(songDiv);
  });

  // Disable previous/next buttons if on the first/last page
  document.getElementById("prev-btn").disabled = currentPage === 1;
  document.getElementById("next-btn").disabled = currentPage * songsPerPage >= songs.length;
}

// Function to change pages
function changePage(direction) {
  currentPage += direction;
  displaySongs();
}

function searchSongs() {
  const query = document.querySelector('.search-bar').value;
  console.log(query);

  // Send the query as a URL parameter in the GET request
  fetch(`/search?query=${encodeURIComponent(query)}`)
    .then(response => response.json())
    .then(data => {
      console.log(data);  // Check the structure of the response
      const tracks = data.tracks.items.slice(0, 5); // Get the first 5 tracks

      // Clear previous results
      const trackList = document.getElementById('track-list');
      trackList.innerHTML = '';

      // Iterate through the tracks and create clickable elements
      tracks.forEach(track => {
        const trackName = track.name;
        const artistName = track.artists.map(artist => artist.name).join(', ');
        const duration = msToTime(track.duration_ms);
      
        // Create a new track element
        const trackElement = document.createElement('div');
        trackElement.classList.add(
          'track-item',
          'flex',
          'items-center',
          'gap-4',
          'p-4',
          'bg-white',
          'rounded-lg',
          'shadow-md',
          'hover:bg-gray-100',
          'hover:shadow-lg',
          'transition',
          'transform',
          'hover:scale-105',
          'cursor-pointer'
        );
      
        trackElement.innerHTML = `
          <div class="flex flex-col">
            <span class="font-semibold text-lg">${trackName}</span>
            <span class="text-gray-600 text-sm">${artistName}</span>
            <span class="text-gray-400 text-xs">${duration}</span>
          </div>
        `;
      
        // Add click event to select track
        trackElement.addEventListener('click', () => selectTrack(track));
      
        // Append the new track element to the track list
        trackList.appendChild(trackElement);
      });

      // Show the overlay
      document.getElementById('overlay').style.display = 'flex';
    })
    .catch(error => console.error('Error:', error));
}
function selectTrack(track) {
  // Handle track selection (e.g., add to playlist, start playback, etc.)
  console.log('Selected track:', track);

  const trackTitle = track.name;
  const trackArtist = track.artists.map(artist => artist.name).join(', '); 
  const trackDuration = msToTime(track.duration_ms);
  const art = track.album.images[2].url;
  const bigArt = track.album.images[1].url;
  const trackUri = track.uri;

  //songs.push({ title: trackTitle, artist: trackArtist, duration: trackDuration, albumArt: art, bigAlbumArt: bigArt});

  const playlistCollection = db.collection('playlist');
  playlistCollection.add({
    title: trackTitle,
    artist: trackArtist,
    albumArt: art,
    bigAlbumArt: bigArt,
    duration: trackDuration,
    songUri: trackUri,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  })
  .then((docRef) => {
    console.log("Track added with ID: ", docRef.id);
  
    songs.push({
      title: trackTitle,
      artist: trackArtist,
      albumArt: art,
      bigAlbumArt: bigArt,
      duration: trackDuration,
      songUri: trackUri,
      docId: docRef.id 
    });
    console.log("pushing a song with songUri: " + trackUri);
  

    displaySongs();
  })
  .catch((error) => {
    console.error('Error adding track: ', error);
  });

  queueSong(trackUri);
  
}

function closeOverlay() {
  // Close the overlay
  document.getElementById('overlay').style.display = 'none';
}

function chooseDevice() {

  fetch('/device')
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      if (data && data.devices && Array.isArray(data.devices)) {
        if (data.devices.length > 0) {
          deviceOverlay(data.devices);
        } else {
          console.warn("No devices found");
        }
      } else {
        console.error("Invalid data format", data);
      }
    })
    .catch(error => {
      console.error('Error fetching devices:', error);
    })
}

function deviceOverlay(devices){
  let overlay = document.getElementById('device-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'device-overlay';
    overlay.className = 'fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 hidden';
    document.body.appendChild(overlay);
  }

  overlay.innerHTML = `
    <div class="bg-gray-900 text-white p-6 rounded-xl shadow-lg w-96">
      <h2 class="text-xl font-semibold mb-4">Select a Device</h2>
      <div id="device-list" class="space-y-2"></div>
    </div>
  `;

  const deviceList = overlay.querySelector('#device-list');

  devices.forEach(device => {
    const deviceElement = document.createElement('div');
    deviceElement.className = "p-3 bg-gray-800 rounded-lg hover:bg-gray-700 cursor-pointer shadow-md transition";
    deviceElement.textContent = device.name;

    deviceElement.addEventListener('click', () => {
      localStorage.setItem('selectedDevice', device.id);
      selectedDevice = device.id;
      console.log('Selected device:', device.id);
      overlay.classList.add('hidden');
    });

    deviceList.appendChild(deviceElement);
  });

  overlay.classList.remove('hidden');

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.classList.add('hidden');
    }
  });
}

function togglePlayback(isMusicPlaying) {
  console.log('deviceID:', selectedDevice);


  fetch(`/togglePlayback?deviceID=${encodeURIComponent(selectedDevice)}&isPlaying=${encodeURIComponent(isMusicPlaying)}`)
  .then(response => response.json())
  .then(data => {
    console.log(data);  // Check the structure of the response

    if (data.status === "success") {
      console.log("Playback succesfully toggled");
      

    } else {
      console.log("Error: " + data.status);
    }
  })
  .catch(error => console.error('Error:', error));

  if(isMusicPlaying == false) stopSongProgress();
  else currentlyPlaying();
}

function queueSong(songUri) {
  console.log('song Uri: ', songUri);
  fetch(`/queueSong?songUri=${encodeURIComponent(songUri)}&deviceID=${encodeURIComponent(selectedDevice)}`)
  .then(response => response.json())
  .then(data => {
    console.log(data);  

    if (data.status === "success") {
      console.log("Song added to queue!");
    } else {
      console.log("Error: " + data.status);
    }
  })
  .catch(error => console.error('Error:', error));
}

function skipSong() {

  fetch(`/skipSong`)
  .then(response => response.json())
  .then(data => {
    console.log(data);  

    if (data.status === "success") {
      console.log("Song skipped");
      currentlyPlaying();
    } else {
      console.log("Error: " + data.status);
    }
  })
  .catch(error => console.error('Error:', error));
}

function currentlyPlaying() {
  console.log("polling current");
  fetch("/currentlyPlaying")
    .then(response => response.json())
    .then(data => {
      if (data.status === "EMPTY_RESPONSE") {
        console.log("No song currently playing or invalid response.");
        stopSongProgress();
        return;
      }

      const currentUri = data?.item?.uri;
      if (!currentUri) return;

      updateSongPreview(data.item); // update UI with new song

      if (data.is_playing) {
        startSongProgress(data); // start progress if playing
      } else {
        stopSongProgress();
      }

      if (isMatchingList && songs.length && currentUri !== songs[0].songUri) {
        deleteSongFromList();
      }

      console.log(songs);
      isMatchingList = songs.length && currentUri === songs[0].songUri;
    })
    .catch(error => console.error("Error:", error));
}

function startSongProgress(data) {
  stopSongProgress(); // Clear old progress timers
  
  const duration = data.item.duration_ms;
  const progress = data.progress_ms;
  const startTime = Date.now() - progress;

  updateProgressBar(startTime, duration);
  
  const remainingMs = duration - progress;
  progressTimeout = setTimeout(currentlyPlaying, remainingMs + 1000);
}

function updateProgressBar(startTime, duration) {
  function update() {
    const elapsed = Date.now() - startTime;
    const percent = Math.min((elapsed / duration) * 100, 100);

    document.getElementById("progressBar").style.width = percent + "%";
    document.getElementById("time-info").innerText = `${formatTime(elapsed)} / ${formatTime(duration)}`;

    if (percent < 100) {
      progressUpdater = setTimeout(update, 1000); // Will naturally stop when cleared
    }
  }
  
  // Clear any existing updater first
  if (progressUpdater) clearTimeout(progressUpdater); 
  update();
}

function stopSongProgress() {
  console.log("STOPPING THE PROGRESS BAR");

  if (progressTimeout) clearTimeout(progressTimeout);
  if (progressUpdater) clearTimeout(progressUpdater);
  progressTimeout = null;
  progressUpdater = null;
}

function formatTime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  // 2-digit format for seconds
  return `${minutes}:${remainingSeconds < 10 ? "0" : ""}${remainingSeconds}`;
}

function updateSongPreview(song) {
  document.getElementById("preview-image").src = song.album.images[1].url;
  document.getElementById("preview-title").innerText = `${song.artists.map(artist => artist.name).join(', ')} - ${song.name}`;
}

function deleteSongFromList(){
  console.log("deleting song from a list");
  const removedSong = songs.shift();
  if (removedSong?.docId) {
    db.collection('playlist').doc(removedSong.docId).delete()
      .then(() => {
        console.log('Track deleted from DB');
      })
      .catch((error) => {
        console.error('Error deleting track: ', error);
      });
  }
  displaySongs();
}

getTracksFromDatabase()
currentlyPlaying()
