# DepthField.js

CSS z-index に基づいて、カメラの被写界深度（ボケ・スケール・奥行き感）を自動適用する軽量JavaScriptライブラリ。

焦点距離・F値・センサーサイズという**カメラの語彙**でWebのレイアウトを表現できます。

---

## 特徴

- **script タグ1行で導入** — インストール不要
- **WebGL不使用** — CSSのみで動作、軽量
- **カメラパラメーターで設定** — 焦点距離・F値・センサーサイズ
- **センサープリセット** — 大判8×10〜スマートフォンまで10種類
- **複数シーン対応** — 1ページに独立したインスタンスを複数配置可能
- **グループ対応** — 関連要素をまとめて同じ奥行きで管理
- **GSAP連携** — `watch: true` でdata-z属性の変化を自動追従

---

## 導入

```html
<script src="depthfield.js"></script>
```

CDN:
```html
<script src="https://cdn.jsdelivr.net/npm/depthfield/depthfield.min.js"></script>
```

---

## data-z の考え方

`data-z` はピント面（`focusPoint`）からの相対的な奥行きを表す抽象値です。単位はcmやmではなく、レイアウト上の任意のスケールです。

| data-z | カメラ的な意味 | 見た目 |
|---|---|---|
| `0`（focusPoint） | ピントが合っている | シャープ・等倍 |
| プラス（例: `+2`） | カメラに近い（手前） | 大きく・ボケる |
| マイナス（例: `-2`） | カメラから遠い（奥） | 小さく・ボケる |

ボケ量はフォーカスポイントとの**差分**をもとに、焦点距離・F値・センサーサイズから自動計算されます。差が大きいほどボケが強くなります。

---

## 基本的な使い方

### HTML — `data-z` で奥行きを指定

```html
<div id="my-scene">
  <div data-z="-2">奥の要素（ボケる・小さくなる）</div>
  <div data-z="0">ピント面（シャープ）</div>
  <div data-z="2">手前の要素（ボケる・大きくなる）</div>
</div>
```

### JavaScript — シーンを初期化

```javascript
DepthField.scene('main', '#my-scene', {
  focalLength : 85,   // 焦点距離 mm（35mm換算）
  aperture    : 1.8,  // F値
  focusPoint  : 0,    // ピントを合わせるz値
  sensor      : 'fullframe',
}).apply();
```

---

## センサープリセット

| キー | センサー | クロップファクター |
|---|---|---|
| `lf810` | 大判 8×10インチ | 0.13x |
| `lf45` | 大判 4×5インチ | 0.28x |
| `mf67` | 中判 6×7 | 0.48x |
| `mf66` | 中判 6×6 | 0.55x |
| `mf645` | 中判 645 | 0.62x |
| `fullframe` | フルサイズ 35mm | 1.0x（デフォルト） |
| `apsc` | APS-C | 1.5x |
| `mft` | マイクロフォーサーズ | 2.0x |
| `inch1` | 1インチ | 2.7x |
| `smartphone` | スマートフォン | 5.4x |

センサーを選ぶと `maxBlur` と `depthScale` が自動で設定されます。

---

## オプション

| オプション | デフォルト | 説明 |
|---|---|---|
| `sensor` | `'fullframe'` | センサープリセット名 |
| `focalLength` | `85` | 焦点距離 mm（35mm換算） |
| `aperture` | `1.8` | F値（小さいほどボケが大きい） |
| `focusPoint` | `0` | ピントを合わせるz値 |
| `depthScale` | センサーから自動 | 奥行き感の強さ |
| `maxBlur` | センサーから自動 | 最大ブラー量 px |
| `transition` | `'0.4s ease'` | CSSトランジション |
| `watch` | `false` | data-z変化の自動監視（GSAP連携用） |

---

## API

### シーンの作成

```javascript
const scene = DepthField.scene(name, container, options);
scene.apply();
```

### フォーカスの移動

```javascript
// 即時
scene.focus(2);

// アニメーション（600ms）
scene.focus(2, 600);
```

### 設定の更新

```javascript
scene.update({
  aperture   : 2.8,
  focalLength: 135,
});
```

### リセット

```javascript
scene.reset();
```

---

## グループ

`data-df-group` で複数の要素を同じ奥行きとして連動させます。

```html
<!-- 写真とラベルが一緒に動く -->
<img  data-z="2" data-df-group="photo-a" src="...">
<span data-z="2" data-df-group="photo-a">キャプション</span>
```

---

## GSAP連携

`watch: true` を指定すると、`data-z` 属性の変化を MutationObserver で監視し、自動的にDepthFieldを再計算します。

```javascript
const scene = DepthField.scene('main', '#scene', {
  focalLength: 85,
  aperture   : 1.8,
  watch      : true,  // GSAP連携を有効化
}).apply();
```

### ⚠️ 重要：入れ子構造が必須

CSSの仕様上、`filter`（DepthFieldのblur）と `transform`（GSAPのx/y移動）を**同じ要素に同時に適用すると合成レイヤーが衝突**し、アニメーションが正しく動作しません。

**「動かす要素」と「ぼかす要素」は必ず分けてください。**

```html
<!-- ✅ 正しい構造：外側で動かし、内側でぼかす -->
<div class="mover">                  <!-- GSAPでx/y/scale等を制御（data-zなし） -->
  <div class="depth" data-z="2">     <!-- DepthFieldがblurを管理（移動させない） -->
    コンテンツ
  </div>
</div>
```

```javascript
// 外側をGSAPで動かす（filterなし → イージング正確）
gsap.to('.mover', { x: 200, duration: 1, ease: 'power2.out' });

// 内側のdata-zでボケを制御（transformなし → filterと干渉しない）
gsap.to('.depth', { attr: { 'data-z': 3 }, duration: 1 });
```

| 役割 | 要素 | ポイント |
|------|------|----------|
| 移動・拡縮・回転 | 外側（`data-z`なし） | filterがないのでGSAPのtransformが正確 |
| ぼかし（奥行き） | 内側（`data-z`あり） | 位置を動かさないのでfilterと干渉しない |

### watch の切り替え

```javascript
scene.update({ watch: true });   // 監視開始
scene.update({ watch: false });  // 監視停止
```

---

## 複数シーンの独立管理

```javascript
// シーンAとシーンBは完全に独立して動作
DepthField.scene('hero',    '#hero-section',  { sensor: 'mf67',      aperture: 2.8 }).apply();
DepthField.scene('gallery', '#photo-gallery', { sensor: 'fullframe',  aperture: 1.4 }).apply();
DepthField.scene('footer',  '#footer',        { sensor: 'apsc',       aperture: 8.0 }).apply();

// 全シーンを一括更新
DepthField.updateAll({ focalLength: 50 });

// 全シーンをリセット
DepthField.resetAll();
```

---

## MotionLabとの組み合わせ

DepthField.js は [MotionLab](https://idstock.net/) と組み合わせることで、GSAPアニメーションに被写界深度を自動付加できます。

上記の入れ子構造を使い、**外側の要素をMotionLabで動かし、内側のdata-z要素で奥行きを制御**します。

```html
<!-- 入れ子構造で役割を分ける -->
<div class="mover">               <!-- MotionLabでx/y/scale等を設定 -->
  <div data-z="0" class="depth">  <!-- MotionLabでz（奥行き）を設定 -->
    コンテンツ
  </div>
</div>
```

```javascript
// DepthFieldの初期化
DepthField.scene('main', '#scene', { watch: true }).apply();
```

MotionLab上では `.mover` にx/y/scale等を、`.depth` にz（奥行き）を設定します。

---

## ライセンス

MIT License — 無償で自由に使用・改変・再配布できます。
本ライブラリの使用によって生じたいかなる損害についても、作者は責任を負いません。
