export default {
  debug: false,
  enableTransliteration: true,
  unlimitedRomanNumerals: false,

  tts: {
    defaultModel: {
      vi: 'Ngọc Huyền (mới)',
      en: 'Libritts_r',
      id: 'Indo_goreng',
    },
    defaultLangModels: {
      en: [],
      id: [],
    },
  },

  asr: {
    defaultModel: 'nghi-stt',
    fallbackModels: ['nghi-stt-v2', 'sherpa-onnx-zipformer-vi-int8-2025-10-16'],
    modelStorageKey: 'asr-selected-model',
  },
};
