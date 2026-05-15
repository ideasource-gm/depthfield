# DepthField.js — 製品まとめ

> 最終更新: 2026-05-15 / v1.2.2

---

## 製品概要

CSS z-indexに基づいてカメラの被写界深度（ボケ・スケール・奥行き感）を自動適用する軽量JavaScriptライブラリ。焦点距離・F値・センサーサイズという**カメラの語彙**でWebのレイアウトを表現できる。

- **ライセンス**: MIT（OSS・無料）
- **npmパッケージ**: `depthfield`
- **CDN**: `https://cdn.jsdelivr.net/npm/depthfield@1.2.2/depthfield.min.js`
- **依存ライブラリ**: なし（WebGL不使用・CSSのみ）

---

## 導入

```html
<!-- CDN（script直読み） -->
<script src="https://cdn.jsdelivr.net/npm/depthfield@1.2.2/depthfield.min.js"></script>

<!-- ESM（bundler） -->
import DepthField from 'depthfield';
```

---

## ビルド構成

| ファイル | 形式 | 用途 |
|---|---|---|
| `depthfield.js` | ES6+ ソース | 開発・読み込み用 |
| `depthfield.min.js` | IIFE（難読化なし） | `<script src>` 直読み |
| `depthfield.esm.js` | ESM | `import` / bundler |

**ビルドコマンド:**
```bash
npm run build           # ESM（terser）+ IIFE（esbuild）
npm run build:obfuscate # 上記 + depthfield.min.jsを難読化
```

---

## data-z の考え方

`data-z` はピント面（`focusPoint`）からの相対的な奥行きを表す抽象値。

| data-z | 意味 | 見た目 |
|---|---|---|
| `0`（focusPoint） | ピントが合っている | シャープ・等倍 |
| プラス（例: `+2`） | カメラに近い（手前） | 大きく・ボケる |
| マイナス（例: `-2`） | カメラから遠い（奥） | 小さく・ボケる |

---

## 主な機能

- **センサープリセット** — 大判8×10〜スマートフォンまで10種類
- **カメラパラメーター** — 焦点距離・F値・センサーサイズで調整
- **複数シーン** — `DepthField.scene()` で1ページに独立したインスタンスを複数配置
- **グループ** — `data-df-group` で複数要素を同じ奥行きで連動
- **フォーカスアニメーション** — `scene.focus(z, duration)` でピント移動
- **GSAP連携** — `watch: true` でdata-z属性の変化を自動追従（MutationObserver）

---

## センサープリセット一覧

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
| `transition` | `'0.4s ease'` | CSSトランジション（blurの変化速度） |
| `watch` | `false` | data-z変化の自動監視（GSAP連携用） |

---

## API

```javascript
// シーン作成
const scene = DepthField.scene('name', '#container', { options });
scene.apply();

// フォーカス移動
scene.focus(2);          // 即時
scene.focus(2, 600);     // 600msでアニメーション

// 設定更新
scene.update({ aperture: 2.8 });

// リセット
scene.reset();

// 全シーン一括操作
DepthField.updateAll({ focalLength: 50 });
DepthField.resetAll();
```

---

## GSAP連携の注意点

### ⚠️ 入れ子構造が必須（推奨）

CSSの仕様上、`filter`（blur）と`transform`（x/y移動）を**同じ要素に同時に適用すると合成レイヤーが衝突**し、イージングが二重にかかったような動きになる。

**正しい構造:**
```html
<div class="mover">               <!-- GSAPでx/y/scale等を制御（data-zなし） -->
  <div class="depth" data-z="2">  <!-- DepthFieldがblurを管理（移動させない） -->
    コンテンツ
  </div>
</div>
```

同じ要素への適用は`will-change: filter, transform`のおかげで多くの場合動作するが、Edgeなどブラウザによってはblurが大きい時に不安定になる場合がある。**入れ子構造を推奨。**

### GSAP連携時の内部動作

GSAPが存在する場合、DepthFieldはblurのみを担当し、それ以外のプロパティには触れない。

- CSS変数 `--df-blur` + `.df-blurred` クラスでblurを管理
- `el.style.transition = 'filter 0.4s ease'` でblurの変化をスムーズに
- scale・opacity・transform・zIndexはGSAPに委ねる

---

## バージョン履歴

| バージョン | 内容 |
|---|---|
| 1.2.2 | GSAPモードでtransitionが効かないバグ修正 |
| 1.2.1 | `--global-name`によるグローバル上書きバグ修正 |
| 1.2.0 | ES6+モダンリライト・ESM/IIFEデュアルビルド対応 |
| 1.1.x | GSAP連携改善・入れ子構造パターン確立 |
| 1.0.x | 初期リリース |
