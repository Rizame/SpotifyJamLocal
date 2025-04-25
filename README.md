A great option for those who are not using spotify but their friends DO, or they just simply do not have the premium subscription: A local alternative for the spotify "Jam" feature!

full-stack music control web application hosted on an ESP32, allowing collaborative playlist management using one Spotify Premium account. Fulle implemented through untegration of Spotify's Web API to support features such as:
Searching and adding tracks to the queue
Skipping, pausing, or resuming playback
Viewing the currently playing song with metadata
Allowing guests to interact without login, while only the host logs into Spotify
Selecting playback devices that are connected to the host (remote speaker, pc, phone, etc.) 

!use case
The user is welcomed with a login screen:
![image](https://github.com/user-attachments/assets/5f01be1c-e025-4248-8439-7f462a3a9cb7)
Where he can either log in to a spotify account, or enter as a guest. If first option is chosen the user is then redirected to spotify login page.

Upon entering the main page, depending on whether anything is actively playing on users account or not he will see the information about current song:
![image](https://github.com/user-attachments/assets/03e4422d-1cf9-45fe-8d9a-bb6bc2eaf1c2)

Then the user must choose his active device where he wants to manipulate music with "Device" button, and after will be able to freely use other features like song search, skip.
Playback change buttons may be used in any case as they manipulate the account adirectly, not depending on a device.
![image](https://github.com/user-attachments/assets/adc665db-7149-4a1d-b3f6-eb853e0c5539)
Here a list of Top 5 options for a given search are shown, user must click on whatever amount of songs he wants to add and then click close button.
All of the songs will be added to the spotify account queue and also will be shown in queue on the web page:
![image](https://github.com/user-attachments/assets/ff7767fd-62ac-4ca2-b57b-b6a4a8e75561)
![image](https://github.com/user-attachments/assets/6d688fa6-fe68-489a-b2d2-b55c7ea06acf)
Lastly, whenever the program spots song from a queue playing - upon its end, or if its skipped, etc the song will then be deleted from the list.



