const elements = {
  cropperModal: document.getElementById('imageCropperModal'),
  cropperImage: document.getElementById('cropperImage'),
  confirmCropButton: document.getElementById('confirmCropButton'),
  cancelCropButton: document.getElementById('cancelCropButton'),
};

let currentResolve = null;
let cropper = null;

function showCropper(imageUrl) {
  elements.cropperImage.src = imageUrl;
  elements.cropperModal.style.display = 'block';
  if (cropper) cropper.destroy();
  cropper = new Cropper(elements.cropperImage, {
    aspectRatio: 1,
    viewMode: 1,
    background: false,
    autoCropArea: 1,
  });
}

function hideCropper() {
  if (cropper) cropper.destroy();
  cropper = null;
  elements.cropperModal.style.display = 'none';
}

export function processImage(file) {
  return new Promise((resolve) => {
    currentResolve = resolve;
    const reader = new FileReader();
    reader.onload = (e) => showCropper(e.target.result);
    reader.readAsDataURL(file);
  });
}

if (elements.confirmCropButton) {
  elements.confirmCropButton.addEventListener('click', () => {
    if (cropper && currentResolve) {
      cropper.getCroppedCanvas({width: 300, height: 300, imageSmoothingQuality: 'high'}).toBlob((blob) => {
        currentResolve(new File([blob], 'processed_image.png', {type: 'image/png'}));
        hideCropper();
      }, 'image/png');
    }
  });
}

if (elements.cancelCropButton) {
  elements.cancelCropButton.addEventListener('click', () => {
    if (currentResolve) currentResolve(null); // キャンセル時はnullを返す
    hideCropper();
  });
}
