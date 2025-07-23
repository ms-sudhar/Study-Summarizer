// === Elements ===
const dropArea = document.getElementById('dropArea');
const fileInput = document.getElementById('fileInput');
const fileList = document.getElementById('fileList');
const fileListItems = document.getElementById('fileListItems');
const generateBtn = document.getElementById('generateBtn');
const resetBtn = document.getElementById('resetBtn');
const processingSection = document.getElementById('processingSection');
const resultSection = document.getElementById('resultSection');
const manualDownloadLink = document.getElementById('manualDownloadLink');

const processingStatus = document.getElementById('processingStatus');
const processingPercentage = document.getElementById('processingPercentage');
const progressBar = document.querySelector('.progress-bar');

const successToast = document.getElementById('successToast');
const errorToast = document.getElementById('errorToast');

// === Drag-and-drop ===
dropArea.addEventListener('click', () => fileInput.click());

dropArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropArea.classList.add('dragover');
});

dropArea.addEventListener('dragleave', () => {
  dropArea.classList.remove('dragover');
});

dropArea.addEventListener('drop', (e) => {
  e.preventDefault();
  dropArea.classList.remove('dragover');
  fileInput.files = e.dataTransfer.files;
  handleFileInput();
});

// === File input ===
fileInput.addEventListener('change', handleFileInput);

function handleFileInput() {
  const files = fileInput.files;
  if (files.length > 0) {
    fileList.classList.remove('hidden');
    fileListItems.innerHTML = '';
    Array.from(files).forEach(file => {
      const li = document.createElement('li');
      li.textContent = file.name;
      fileListItems.appendChild(li);
    });
    generateBtn.disabled = false;
  } else {
    fileList.classList.add('hidden');
    fileListItems.innerHTML = '';
    generateBtn.disabled = true;
  }
}

// === Generate button ===
generateBtn.addEventListener('click', async () => {
  const files = fileInput.files;
  if (files.length === 0) {
    showErrorToast("No files selected!");
    return;
  }

  // Reset progress & show processing
  processingSection.classList.remove('hidden');
  resultSection.classList.add('hidden');
  updateProgress("Starting upload...", 5);

  const formData = new FormData();
  Array.from(files).forEach(file => {
    formData.append('file', file);
  });

  try {
    const response = await fetch('/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.statusText}`);
    }

    const reader = response.body.getReader();
    let receivedText = '';
    const decoder = new TextDecoder('utf-8');

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      receivedText += decoder.decode(value, { stream: true });

      // Each line is a JSON status message
      const lines = receivedText.split('\n').filter(line => line.trim() !== '');
      const lastLine = lines[lines.length - 1];
      const status = JSON.parse(lastLine);

      if (status.status === 'error') {
        showErrorToast(status.message || "An error occurred");
        break;
      } else if (status.status === 'Done') {
        updateProgress("Packaging complete!", 100);
        showSuccessToast();
        resultSection.classList.remove('hidden');
        manualDownloadLink.href = '/study_summaries.zip';
        manualDownloadLink.download = 'study_summaries.zip';
      } else {
        updateProgress(status.status, status.percentage);
      }
    }

  } catch (err) {
    console.error(err);
    showErrorToast(err.message);
  }
});

// === Reset button ===
resetBtn.addEventListener('click', () => {
  fileInput.value = '';
  fileList.classList.add('hidden');
  fileListItems.innerHTML = '';
  generateBtn.disabled = true;
  processingSection.classList.add('hidden');
  resultSection.classList.add('hidden');
});

// === Update progress ===
function updateProgress(message, percentage) {
  processingStatus.textContent = message;
  processingPercentage.textContent = `${percentage}%`;
  progressBar.style.width = `${percentage}%`;
}

// === Toasts ===
function showSuccessToast() {
  successToast.classList.add('show');
  setTimeout(() => {
    successToast.classList.remove('show');
  }, 3000);
}

function showErrorToast(message = "An error occurred") {
  errorToast.querySelector('span').textContent = message;
  errorToast.classList.add('show');
  setTimeout(() => {
    errorToast.classList.remove('show');
  }, 3000);
}
