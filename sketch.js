/* Mood Stabilizer
 * By Michael Hesmond
 * This code uses ml5.faceMesh to detect a simple facial expression of smile or frown. 
 * This is then feed into a mock chat interface and the messages will be positive or negitive based on the uses facial expression
 *
 * --- MODIFIED with centered, "cover" video background ---
 */

// --- ml5 face detection settings---
let faceMesh;
let video; // This is our webcam capture
let faces = [];
let options = { maxFaces: 1, refineLandmarks: true, flipHorizontal: false };

// --- DOM Elements ---
let input; // This will hold our text input box
let smileButton, sendButton, heartButton; // Buttons

// The 'chatMessages' array is NOT in this file.
// It is in 'messages.js' file.

// --- Chat Simulation Settings ---
let activeChat = []; // Array to hold messages currently on screen
let filteredList = []; // The sub-list of messages we are picking from
let nextMessageTime = 0; // Timer for when to post the next message
let minInterval = 500; // (milliseconds)
let maxInterval = 2500; // (milliseconds)

// --- Sentiment Control ---
let minSentiment = -1.0;
let maxSentiment = 1.0;

// --- Visual Settings (Modified for Left Side) ---
let chatBoxWidth; // Will be set as a percentage of screen width
let paddingX = 50; // Padding from the LEFT
let paddingTop = 50; // Padding from the TOP (for title)
let paddingBottom = 30; // Padding from the BOTTOM (Set this to move UI up/down)
let textFontSize = 16;
// ... (rest of variables)
let inputHeight = 50; // Height for the new input box and buttons
let messageBoxHeight = 40; // This is the new box height
let messageBoxMargin = 2; // This is the new gap

function setup() {
  // Create a canvas that fills the entire browser window
  createCanvas(windowWidth, windowHeight);

  // --- Face detection ---
  video = createCapture(VIDEO);
  // video.size(width, height); // <-- REMOVED THIS LINE
  video.hide();

  // --- Initialize faceMesh ---
  // We pass the video, options, and a callback function
  faceMesh = ml5.faceMesh(video, options, modelReady);

  // --- Set new chat box position ---
  chatBoxWidth = width * 0.85;

  // Set up text styling
  textSize(textFontSize);

  // Use HSB color mode for easy sentiment mapping
  colorMode(HSB, 360, 100, 100, 1.0);

  // --- Create and Style Input Box ---
  input = createInput();
  input.attribute('placeholder', 'comments...');

  // --- Create Buttons ---
  smileButton = createButton('☺'); // Simple smiley
  sendButton = createButton('⌲'); // Simple plane
  heartButton = createButton('♡'); // Outline heart
  // NOTE: positionBottomUI() is called in modelReady()

  // Filter the list for the first time
  updateFilteredList();

  // Set the first message timer
  setNewTimer();
}

// This new callback function runs *only* when the model is loaded
function modelReady() {
  console.log("FaceMesh Model Ready!");

  // Now that the model is ready, we can position the UI
  positionBottomUI();

  // And now we can start detecting faces
  faceMesh.detectStart(video, gotFaces);
}

function draw() {
  
  // --- NEW: Centered & Cropped Video Background ---
  // We must wait for the video to start loading
  if (video.width > 0) {
    let canvasAspect = width / height;
    let videoAspect = video.width / video.height;
    let dWidth, dHeight, dx, dy;

    if (videoAspect > canvasAspect) {
      // Video is WIDER than canvas
      dHeight = height;
      dWidth = dHeight * videoAspect;
      dy = 0;
      dx = (width - dWidth) / 2;
    } else {
      // Video is TALLER than canvas
      dWidth = width;
      dHeight = dWidth / videoAspect;
      dx = 0;
      dy = (height - dHeight) / 2;
    }
    // Draw the video with the calculated position and dimensions
    image(video, dx, dy, dWidth, dHeight);
    
  } else {
    // Before video loads, just draw a black background
    background(0);
  }
  // --- END of new video logic ---

  // add username to top of page
  // Draw the user name at the top
  push(); // Save current drawing style
  fill(255); // White color
  noStroke();
  textSize(32); // Large font size (you can change 32)
  textAlign(LEFT, TOP);
  // Use chatPadding for consistent spacing from the top
  text("👤 Username", paddingX, paddingTop);
  pop(); // Restore previous drawing style

  // --- Face Tracking Loop ---
  // This loop's ONLY job is to update the sentiment filters
  // It won't run until modelReady() calls detectStart()
  for (let i = 0; i < faces.length; i++) {
    let face = faces[i];
    let horzMidX = (face.keypoints[78].x + face.keypoints[308].x) / 2;
    let horzMidY = (face.keypoints[78].y + face.keypoints[308].y) / 2;
    let vertMidX = (face.keypoints[13].x + face.keypoints[14].x) / 2;
    let vertMidY = (face.keypoints[13].y + face.keypoints[14].y) / 2;

    // detect smile or frown by comparing mid points
    let expressionIndex = vertMidY - horzMidY;

    // normalize expression index -1 to +1
    if (expressionIndex < 0) {
      expressionIndex = expressionIndex / 5;
    } else {
      expressionIndex = expressionIndex / 10;
    }
    constrain(expressionIndex, -0.9, 0.9);
    console.log("Expression index = " + expressionIndex);

    // update sentiment of messages
    minSentiment = -expressionIndex - 0.1;
    maxSentiment = -expressionIndex + 0.1;
  }

  // --- Chat Logic ---

  // 1. Update the filtered list every frame
  updateFilteredList(); // <-- MOVED HERE

  // 2. Draw the messages
  drawMessages();

  // 3. Check if it's time to post a new message
  if (millis() > nextMessageTime) {
    postNewMessage();
    setNewTimer();
  }
}
// --- Core Logic ---

function postNewMessage() {
  // 1. Pick a random message from the CURRENTLY filtered list
  if (filteredList.length > 0) {
    let newMessage = random(filteredList);
    activeChat.push(newMessage);
  }

  // 2. Keep the chat from getting too long
  if (activeChat.length > 100) {
    activeChat.shift();
  }
}

function setNewTimer() {
  // Set the next time to post a message
  nextMessageTime = millis() + random(minInterval, maxInterval);
}

function updateFilteredList() {
  // Check if chatMessages exists before filtering
  if (typeof chatMessages !== 'undefined') {
    filteredList = chatMessages.filter(
      (msg) => msg.sentiment >= minSentiment && msg.sentiment <= maxSentiment
    );

    // Log to the console so you know it worked
    // console.log(
    //   `${filteredList.length} messages available.`
    // );
  }
}

// --- Drawing Functions (Modified) ---

function drawMessages() {
  // Calculate the total height of one message (box + gap)
  let totalMsgHeight = messageBoxHeight + messageBoxMargin;

  // Set text properties
  textAlign(LEFT, TOP);

  // --- Define Fade Zone ---
  let chatTop = height / 2.5;
  let fadeStart = height * 0.7; // Text is 100% visible below this

  // Calculate starting Y position (top of the *first* box)
  // USE NEW PADDING VARIABLE HERE
  let y = height - paddingBottom - inputHeight - totalMsgHeight;

  // Loop backwards through the active chat
  for (let i = activeChat.length - 1; i >= 0; i--) {
    let msg = activeChat[i];

    // --- Calculate Alpha for Fade ---
    let alpha = 1.0; // Default: fully visible
    if (y < fadeStart) {
      // We are in the fade zone
      alpha = map(y, fadeStart, chatTop, 1.0, 0.0);
    }
    alpha = constrain(alpha, 0.0, 1.0); // Ensure alpha is valid

    // --- Map sentiment to color ---
    let sentimentHue = map(msg.sentiment, -1, 1, 0, 120);

    // --- Set new text colors ---
    strokeWeight(2); // Add an outline
    stroke(sentimentHue, 90, 90, alpha); // Outline color + alpha
    fill(0, 0, 100, alpha); // Fill color = white + alpha

    // Draw the text, allowing it to wrap
    // USE NEW PADDING VARIABLES HERE
    text(
      "👤 " + msg.text,
      paddingX,
      y, // y is the TOP of the message box
      chatBoxWidth - paddingX * 2, // Max width
      messageBoxHeight // Constrain text to this height
    );

    // Move Y position up for the next message
    y -= totalMsgHeight; // Use the full box height

    // Stop drawing if we go off the top of the CHAT AREA
    if (y < chatTop) {
      break;
    }
  }
}

// --- Helper Functions ---

// NEW function to style the buttons
// NEW function to style the buttons
function styleButton(button, x, y, size) {
  button.position(x, y);
  button.size(size, size);

  // Apply CSS Styles
  button.style('background-color', 'transparent');
  button.style('border', 'none'); // <-- CHANGED THIS
  button.style('color', 'white');
  button.style('font-size', (size * 0.5) + 'px'); // Scale emoji size
  // button.style('border-radius', '50%'); // <-- REMOVED THIS
  button.style('padding', '0');

  // These help center the emoji inside the circle
  button.style('display', 'flex');
  button.style('align-items', 'center');
  button.style('justify-content', 'center');
}

// RENAMED function to position all bottom UI
function positionBottomUI() {
  let boxY = height - inputHeight - paddingBottom;
  let inputX = paddingX;
  // Input box takes 2/3 of the width, minus its own padding
  let inputWidth = (width * (2 / 3)) - paddingX;

  // Position and style the input box
  input.position(inputX, boxY);
  input.size(inputWidth, inputHeight);
  input.style('background-color', 'transparent');
  input.style('color', 'white'); // Text you type will be white
  input.style('font-size', textFontSize + 'px');
  input.style('border', '2px solid rgba(255, 255, 255, 0.5)');
  input.style('border-radius', '20px'); // Rounded edges
  input.style('padding', '10px');
  input.style('box-sizing', 'border-box'); // Makes sizing easier

  // --- Position Buttons ---
  let buttonSize = inputHeight;

  // Calculate the area available for buttons
  let buttonAreaX = inputX + inputWidth;
  let buttonAreaWidth = width - buttonAreaX;

  // We will have 4 gaps: [gap] [btn] [gap] [btn] [gap] [btn] [gap]
  let gapSize = (buttonAreaWidth - (3 * buttonSize)) / 4;

  // Calculate X position for each button
  let button1_X = buttonAreaX + gapSize;
  let button2_X = button1_X + buttonSize + gapSize;
  let button3_X = button2_X + buttonSize + gapSize;

  // Style and position the buttons
  styleButton(smileButton, button1_X, boxY, buttonSize);
  styleButton(sendButton, button2_X, boxY, buttonSize);
  styleButton(heartButton, button3_X, boxY, buttonSize);
}

// Callback function for when faceMesh outputs data
function gotFaces(results) {
  // Save the output to the faces variable
  faces = results;
}

// This function is called by p5.js automatically
// whenever the browser window is resized.
function windowResized() {
  // Resize the canvas to the new window dimensions
  resizeCanvas(windowWidth, windowHeight);
  // Resize the video capture to match
  // video.size(width, height); // <-- REMOVED THIS LINE

  // Recalculate chat box width
  chatBoxWidth = width * 0.85;

  // Reposition the UI (it's safe to call this)
  positionBottomUI();
}
