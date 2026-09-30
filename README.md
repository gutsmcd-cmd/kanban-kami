# かんばん紙（Kanban Kami）

自分用のかんばん PWA。**無料・広告なし・ログイン不要・オフライン対応。同期しません。**

## できること

- 列は初期で「やること / やっている / 完了」（英語表示では To do / Doing / Done）。列名は変更できる
- カードの追加、タイトルとメモの編集、削除（元に戻す）
- 左のつまみをドラッグして、列の中の並べ替えと列の間の移動（タッチ可）
- 名前付きのボードを複数

データはこの端末の IndexedDB だけです。

## English

**Kanban Kami** is a personal kanban. Default columns are To do / Doing / Done (やること / やっている / 完了) and can be renamed. Add cards with a title and optional note, edit or delete them, and drag the handle to reorder or move between columns — including on touch. Several named boards. No login and no sync. Stored in IndexedDB on this device. Works offline.

## 開発 / Development

```bash
npm install
npm run dev
npm run build
```

Vite + vanilla TypeScript + vite-plugin-pwa（`registerType: 'autoUpdate'`, `base: './'`）。
