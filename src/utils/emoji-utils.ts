import * as NodeEmoji from 'node-emoji';

/**
 * 文字列をHTMLエスケープします。
 *
 * @param target エスケープしたい文字列
 */
function escape_html (target: string): string {
  if (typeof target !== 'string') {
    return target;
  }
  return target.replace(/[&'`"<>]/g, match => {
    return {
      '&': '&amp;',
      "'": '&#x27;',
      '`': '&#x60;',
      '"': '&quot;',
      '<': '&lt;',
      '>': '&gt;',
    }[match];
  });
}

/**
 * カスタムEmojiも含め、タスク名にEmojiが含まれていたら、対応するEmojiに変換します。
 * カスタムEmojiの場合はUniCodeに存在しないため、画像へのリンク(imgタグに変換します。)
 * そのため、このツールで変換した文字列はタグを有効にしてHTMLへ組み込む必要があり、
 * Emoji変換以外の部分はHTMLエスケープされます。
 */
export class EmojiTool {

  EmojiTool() {
  }

  initialize(): Promise<void> {
    // TODO: カスタムえもじの取得
    return Promise.resolve();
  }

  emojify(target: string): string {
    target = escape_html(target);
    // TODO: カスタム絵文字の変換
    return NodeEmoji.emojify(target);
  }
}
