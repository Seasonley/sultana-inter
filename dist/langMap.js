"use strict";
/**
 * Language short-code → FLORES-200 code mapping.
 * Covers 40+ common languages. Unknown codes can be passed raw via --model-code.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.toFlores = toFlores;
exports.getInitExt = getInitExt;
const FLORES_MAP = {
    zh: 'zho_Hans',
    'zh-cn': 'zho_Hans',
    'zh-tw': 'zho_Hant',
    en: 'eng_Latn',
    ja: 'jpn_Jpan',
    ko: 'kor_Hang',
    fr: 'fra_Latn',
    de: 'deu_Latn',
    es: 'spa_Latn',
    pt: 'por_Latn',
    ru: 'rus_Cyrl',
    ar: 'arb_Arab',
    it: 'ita_Latn',
    nl: 'nld_Latn',
    pl: 'pol_Latn',
    tr: 'tur_Latn',
    vi: 'vir_Latn',
    th: 'tha_Thai',
    id: 'ind_Latn',
    ms: 'zsm_Latn',
    hi: 'hin_Deva',
    bn: 'ben_Beng',
    ta: 'tam_Taml',
    te: 'tel_Telu',
    ml: 'mal_Mlym',
    sw: 'swh_Latn',
    sv: 'swe_Latn',
    no: 'nob_Latn',
    da: 'dan_Latn',
    fi: 'fin_Latn',
    cs: 'ces_Latn',
    sk: 'slk_Latn',
    hu: 'hun_Latn',
    ro: 'ron_Latn',
    bg: 'bul_Cyrl',
    hr: 'hrv_Latn',
    sr: 'srp_Cyrl',
    uk: 'ukr_Cyrl',
    el: 'ell_Grek',
    he: 'heb_Hebr',
    fa: 'pes_Arab',
    ur: 'urd_Arab',
    ca: 'cat_Latn',
    eu: 'eus_Latn',
    gl: 'glg_Latn',
    af: 'afr_Latn',
    sq: 'sqi_Latn',
    et: 'est_Latn',
    lv: 'lvs_Latn',
    lt: 'lit_Latn',
    sl: 'slv_Latn',
    bs: 'bos_Latn',
    mk: 'mkd_Cyrl',
    ka: 'kat_Geor',
    hy: 'hye_Armn',
    kk: 'kaz_Cyrl',
    uz: 'uzn_Latn',
    mn: 'khk_Cyrl',
    ne: 'npi_Deva',
    si: 'sin_Sinh',
    km: 'khm_Khmr',
    my: 'mya_Mymr',
    am: 'amh_Ethi',
};
/**
 * Resolve a human-friendly short code (e.g. 'zh') to a FLORES-200 code.
 * Returns the input unchanged if it's already a valid FLORES code or unknown.
 */
function toFlores(code) {
    const lower = code.toLowerCase();
    return FLORES_MAP[lower] || code;
}
/**
 * Get the default output extension for i18n init file.
 */
function getInitExt(framework) {
    switch (framework) {
        case 'vue':
            return 'ts';
        case 'react':
            return 'tsx';
        case 'angular':
            return 'ts';
        default:
            return 'ts';
    }
}
//# sourceMappingURL=langMap.js.map