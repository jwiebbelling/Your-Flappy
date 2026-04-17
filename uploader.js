import { ACCEPTED_IMAGE_TYPES } from './constants.js';

export function setupUploader({ input, preview, hiddenImage, statusNode, defaultSrc, onCharacterReady }) {
  preview.src = defaultSrc;
  preview.hidden = false;
  hiddenImage.src = defaultSrc;

  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      statusNode.textContent = 'Unsupported file type';
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.addEventListener('load', () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result) {
        statusNode.textContent = 'Could not read image';
        return;
      }

      hiddenImage.onload = () => {
        preview.src = result;
        preview.hidden = false;
        statusNode.textContent = file.name;
        onCharacterReady(hiddenImage, file.name);
      };

      hiddenImage.onerror = () => {
        statusNode.textContent = 'Image could not be loaded';
      };

      hiddenImage.src = result;
    });

    reader.readAsDataURL(file);
  });
}