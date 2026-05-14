/**
 * DepthField.js
 * z-indexに基づいてカメラの被写界深度（ボケ・スケール）を自動適用するライブラリ
 * シーン・グループ対応版
 */
(function(global) {
  'use strict';

  // ── センサーサイズプリセット ──────────────────────────────────
  // CoC（錯乱円）= センサー対角線 / 1500（業界標準の近似式）
  // blurMultiplier = センサーCoC / フルサイズCoC（0.029mm）
  //
  //  センサー          実寸(mm)      対角線    cropFactor  CoC      blurMultiplier
  //  大判 8×10        203×254       324mm     0.13x       0.216    7.45
  //  大判 4×5          95×120       153mm     0.28x       0.102    3.52
  //  中判 6×7          56×70         89.6mm   0.48x       0.060    2.07
  //  中判 6×6          56×56         79.2mm   0.55x       0.053    1.83
  //  中判 645          56×42         70.0mm   0.62x       0.047    1.62
  //  フルサイズ        36×24         43.3mm   1.00x       0.029    1.00  ← 基準
  //  APS-C             24×16         28.8mm   1.50x       0.019    0.66
  //  マイクロ4/3       17×13         21.6mm   2.00x       0.014    0.50
  //  1インチ           13×9.6        16.1mm   2.70x       0.011    0.37
  //  スマートフォン     6.4×4.8        8.0mm   5.40x       0.005    0.18
  const SENSORS = {
    // ── 大判 ──────────────────────────────────────────────────
    lf810: {
      name          : '大判 8×10インチ (0.13x)',
      cropFactor    : 0.13,
      blurMultiplier: 7.45,
      depthScale    : 0.070,
      maxBlur       : 55,
    },
    lf45: {
      name          : '大判 4×5インチ (0.28x)',
      cropFactor    : 0.28,
      blurMultiplier: 3.52,
      depthScale    : 0.042,
      maxBlur       : 42,
    },
    // ── 中判 ──────────────────────────────────────────────────
    mf67: {
      name          : '中判 6×7 (0.48x)',
      cropFactor    : 0.48,
      blurMultiplier: 2.07,
      depthScale    : 0.028,
      maxBlur       : 30,
    },
    mf66: {
      name          : '中判 6×6 (0.55x)',
      cropFactor    : 0.55,
      blurMultiplier: 1.83,
      depthScale    : 0.025,
      maxBlur       : 26,
    },
    mf645: {
      name          : '中判 645 (0.62x)',
      cropFactor    : 0.62,
      blurMultiplier: 1.62,
      depthScale    : 0.022,
      maxBlur       : 22,
    },
    // ── 35mm判（フルサイズ）＝基準 ────────────────────────────
    fullframe: {
      name          : 'フルサイズ 35mm (1.0x)',
      cropFactor    : 1.0,
      blurMultiplier: 1.00,
      depthScale    : 0.015,
      maxBlur       : 14,
    },
    // ── デジタル小型センサー ──────────────────────────────────
    apsc: {
      name          : 'APS-C (1.5x)',
      cropFactor    : 1.5,
      blurMultiplier: 0.66,
      depthScale    : 0.012,
      maxBlur       : 9,
    },
    mft: {
      name          : 'マイクロフォーサーズ (2x)',
      cropFactor    : 2.0,
      blurMultiplier: 0.50,
      depthScale    : 0.010,
      maxBlur       : 7,
    },
    inch1: {
      name          : '1インチ (2.7x)',
      cropFactor    : 2.7,
      blurMultiplier: 0.37,
      depthScale    : 0.008,
      maxBlur       : 5,
    },
    smartphone: {
      name          : 'スマートフォン (5.4x)',
      cropFactor    : 5.4,
      blurMultiplier: 0.18,
      depthScale    : 0.005,
      maxBlur       : 2,
    },
  };

  // ── デフォルト設定 ────────────────────────────────────────────
  const DEFAULTS = {
    sensor      : 'fullframe', // センサープリセット名
    focalLength : 85,    // 焦点距離 mm（35mm換算）
    aperture    : 1.8,   // F値（1.4=大ボケ / 2.8=中ボケ / 8=小ボケ / 16=ほぼなし）
    focusPoint  : 0,     // ピントを合わせるz-index値
    depthScale  : 0.015, // z-index1単位あたりの奥行き感（sensorで自動設定）
    maxBlur     : 14,    // 最大ブラー量px（sensorで自動設定）
    transition  : '0.4s ease',
    watch       : false, // trueにするとdata-z属性の変化を自動監視（GSAP連携用）
  };

  const ALLOWED_KEYS = ['sensor', 'focalLength', 'aperture', 'focusPoint', 'depthScale', 'maxBlur', 'transition', 'watch'];

  function sanitizeOptions(options) {
    if (!options || typeof options !== 'object') return {};
    const safe = {};
    ALLOWED_KEYS.forEach(function(key) {
      if (Object.prototype.hasOwnProperty.call(options, key)) safe[key] = options[key];
    });
    return safe;
  }

  // センサープリセットをcfgに反映（手動指定がない場合のみ）
  function applySensorPreset(cfg) {
    const preset = SENSORS[cfg.sensor];
    if (!preset) return cfg;
    // depthScale・maxBlurはセンサープリセットから自動設定（手動上書き可）
    cfg._blurMultiplier = preset.blurMultiplier;
    if (cfg.depthScale === DEFAULTS.depthScale) cfg.depthScale = preset.depthScale;
    if (cfg.maxBlur    === DEFAULTS.maxBlur)    cfg.maxBlur    = preset.maxBlur;
    return cfg;
  }

  // ── 計算 ─────────────────────────────────────────────────────
  function calcBlur(zIndex, cfg) {
    const distance   = Math.abs(zIndex - cfg.focusPoint);
    const multiplier = cfg._blurMultiplier || 1.0;
    const blur = (distance * cfg.focalLength * multiplier) / (cfg.aperture * 10);
    return Math.min(blur, cfg.maxBlur);
  }

  function calcScale(zIndex, cfg) {
    const distance  = (zIndex - cfg.focusPoint) * cfg.depthScale;
    const perspective = cfg.focalLength / 50;
    return Math.max(0.3, 1 + distance / perspective);
  }

  function calcOpacity(zIndex, cfg) {
    const distance = Math.abs(zIndex - cfg.focusPoint);
    return Math.max(0.4, 1 - distance * 0.06);
  }

  // ── 要素への適用 ──────────────────────────────────────────────
  function applyToElement(el, zIndex, cfg) {
    const blur    = calcBlur(zIndex, cfg);
    const scale   = calcScale(zIndex, cfg);
    const opacity = calcOpacity(zIndex, cfg);

    el.style.zIndex     = Math.round(zIndex + 100);
    el.style.position   = el.style.position || 'relative';
    el.style.filter     = blur > 0.1 ? 'blur(' + blur.toFixed(2) + 'px)' : '';
    el.style.transform  = 'scale(' + scale.toFixed(4) + ')';
    el.style.opacity    = opacity.toFixed(3);
    el.style.transition = 'filter ' + cfg.transition + ', transform ' + cfg.transition + ', opacity ' + cfg.transition;
  }

  // ── イージング ────────────────────────────────────────────────
  function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }

  // ── Sceneクラス ───────────────────────────────────────────────
  /**
   * 1つのシーンを管理するクラス
   * シーンはページ内の特定エリアに独立したDepthFieldを適用する単位
   */
  function Scene(containerOrSelector, options) {
    this._cfg      = applySensorPreset(Object.assign({}, DEFAULTS, sanitizeOptions(options)));
    this._observer = null;

    // コンテナの解決
    if (typeof containerOrSelector === 'string') {
      this._container = document.querySelector(containerOrSelector);
    } else {
      this._container = containerOrSelector;
    }

    if (!this._container) {
      console.warn('[DepthField] コンテナが見つかりません:', containerOrSelector);
      return;
    }

    if (this._cfg.watch) this._startWatching();
  }

  Scene.prototype = {
    /**
     * シーン内の全要素にDepthFieldを適用
     */
    apply: function() {
      if (!this._container) return this;
      const cfg = this._cfg;

      // グループ（data-df-group）をまとめて処理
      const groups = this._container.querySelectorAll('[data-df-group]');
      const processedGroups = new Set();

      groups.forEach(function(el) {
        const groupName = el.dataset.dfGroup;
        if (processedGroups.has(groupName)) return;
        processedGroups.add(groupName);

        // グループ内の全要素に同じz値を適用
        const zIndex = parseFloat(el.dataset.z) || 0;
        const groupEls = Array.from(this._container.querySelectorAll('[data-df-group]'))
          .filter(function(e) { return e.dataset.dfGroup === groupName; });
        groupEls.forEach(function(groupEl) {
          applyToElement(groupEl, zIndex, cfg);
        });
      }.bind(this));

      // 通常要素（data-z のみ）を処理
      const singles = this._container.querySelectorAll('[data-z]:not([data-df-group])');
      singles.forEach(function(el) {
        const zIndex = parseFloat(el.dataset.z) || 0;
        applyToElement(el, zIndex, cfg);
      });

      return this;
    },

    /**
     * フォーカスポイントを変更
     * @param {number} zIndex   ピントを合わせるz値
     * @param {number} duration アニメーション時間ms
     */
    focus: function(zIndex, duration) {
      if (duration) {
        const startFocus = this._cfg.focusPoint;
        const startTime  = performance.now();
        const self       = this;

        function tick(now) {
          const elapsed  = now - startTime;
          const progress = Math.min(elapsed / duration, 1);
          self._cfg.focusPoint = startFocus + (zIndex - startFocus) * easeInOut(progress);
          self.apply();
          if (progress < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
      } else {
        this._cfg.focusPoint = zIndex;
        this.apply();
      }
      return this;
    },

    /**
     * エフェクトを解除
     */
    reset: function() {
      if (!this._container) return this;
      this._stopWatching();
      this._container.querySelectorAll('[data-z], [data-df-group]').forEach(function(el) {
        el.style.filter     = '';
        el.style.transform  = '';
        el.style.opacity    = '';
        el.style.zIndex     = '';
        el.style.transition = '';
      });
      return this;
    },

    /**
     * data-z属性の変化を MutationObserver で監視する（GSAP連携用）
     * watch: true の時に自動起動、または手動で呼べる
     */
    _startWatching: function() {
      if (this._observer || !this._container) return;
      const self = this;
      this._observer = new MutationObserver(function(mutations) {
        let needsUpdate = false;
        mutations.forEach(function(m) {
          if (m.attributeName === 'data-z') needsUpdate = true;
        });
        if (needsUpdate) self.apply();
      });
      this._observer.observe(this._container, {
        attributes     : true,
        attributeFilter: ['data-z'],
        subtree        : true,
      });
      return this;
    },

    /**
     * 監視を停止する
     */
    _stopWatching: function() {
      if (this._observer) {
        this._observer.disconnect();
        this._observer = null;
      }
      return this;
    },

    /**
     * 設定を更新して再適用
     */
    update: function(options) {
      const safe = sanitizeOptions(options);
      Object.assign(this._cfg, safe);
      if (safe.sensor) applySensorPreset(this._cfg);
      // watchのon/off切り替え
      if (safe.watch === true  && !this._observer) this._startWatching();
      if (safe.watch === false &&  this._observer) this._stopWatching();
      this.apply();
      return this;
    },

    /**
     * 現在の設定を取得
     */
    getConfig: function() {
      return Object.assign({}, this._cfg);
    },
  };

  // ── 公開API ──────────────────────────────────────────────────
  global.DepthField = {
    _scenes: {},
    SENSORS: SENSORS,

    /**
     * シンプルに全ページへ適用（後方互換）
     */
    init: function(options) {
      this._default = new Scene(document.body, options);
      this._default.apply();
      return this._default;
    },

    /**
     * 名前付きシーンを作成・取得
     * @param {string} name                シーン名
     * @param {string|Element} container   対象コンテナ
     * @param {object} options             設定
     */
    scene: function(name, container, options) {
      if (!this._scenes[name]) {
        this._scenes[name] = new Scene(container, options);
      }
      return this._scenes[name];
    },

    /**
     * 全シーンを一括更新
     */
    updateAll: function(options) {
      Object.values(this._scenes).forEach(function(scene) {
        scene.update(options);
      });
      if (this._default) this._default.update(options);
      return this;
    },

    /**
     * 全シーンをリセット
     */
    resetAll: function() {
      Object.values(this._scenes).forEach(function(scene) {
        scene.reset();
      });
      if (this._default) this._default.reset();
      return this;
    },

    Scene: Scene,
  };

})(window);
