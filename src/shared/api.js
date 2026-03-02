import config from '../../nghitts.config.js';

export const DEFAULT_MODEL = config.tts.defaultModel;
export const DEFAULT_LANG_MODELS = config.tts.defaultLangModels;
export const DEFAULT_ASR_MODEL = config.asr.defaultModel;
export const ASR_MODELS_FALLBACK = config.asr.fallbackModels;
export const ASR_MODEL_STORAGE_KEY = config.asr.modelStorageKey;

export function getModelBaseUrl(lang) {
  if (import.meta.env.PROD) {
    return `/api/model/piper/${lang}/`;
  }
  return `${import.meta.env.BASE_URL}tts-model/${lang}/`;
}

export function getModelsListUrl(lang) {
  return `/api/piper/${lang}/models`;
}

export function getASRModelsListUrl() {
  return '/api/asr/models';
}

export const ASR_CODE_BASE = '/asr-wasm/';

const ASR_MODEL_FILES = [
  'sherpa-onnx-wasm-main-vad-asr.wasm',
  'sherpa-onnx-wasm-main-vad-asr.data',
  'sherpa-onnx-wasm-main-vad-asr.js',
];

export function getASRAssetUrl(filename, model = DEFAULT_ASR_MODEL) {
  if (ASR_MODEL_FILES.includes(filename)) {
    if (import.meta.env.PROD) {
      return `/api/model/asr/${model}/${filename}`;
    }
    return `${import.meta.env.BASE_URL || '/'}asr-model/${model}/${filename}`;
  }
  return `${ASR_CODE_BASE}${filename}`;
}
