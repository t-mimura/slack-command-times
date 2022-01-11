import * as NodeEmoji from 'node-emoji';
import * as request from 'request';

import { logger } from './logger';

/**
 * 文字列をHTMLエスケープします。
 *
 * @param target エスケープしたい文字列
 */
function escape_html (target: string): string {
  if (typeof target !== 'string') {
    return target;
  }
  return target.replace(/[&'`"<>]/g, (match: string): string => {
    return {
      '&': '&amp;',
      "'": '&#x27;',
      '`': '&#x60;',
      '"': '&quot;',
      '<': '&lt;',
      '>': '&gt;',
    }[match] || '';
  });
}

/**
 * カスタムEmojiも含め、タスク名にEmojiが含まれていたら、対応するEmojiに変換します。
 * カスタムEmojiの場合はUniCodeに存在しないため、画像へのリンク(imgタグに変換します。)
 * そのため、このツールで変換した文字列はタグを有効にしてHTMLへ組み込む必要があり、
 * Emoji変換以外の部分はHTMLエスケープされます。
 */
export class EmojiTool {

  private customEmoji: { [name: string]: string };

  private EmojiTool() {
  }

  /**
   * 絵文字ツールのインスタンスを取得します。
   *
   * @param teamId カスタム絵文字を解決したいチームのID
   * @param token カスタム絵文字を取得するためのtoken
   * @return 絵文字ツールのインスタンス
   */
  static getInstance(teamId: string, token: string): Promise<EmojiTool> {
    const returnValue = new EmojiTool();
    return new Promise<EmojiTool>((resolve, reject) => {
      request.post('https://slack.com/api/emoji.list', { form: { token } }, (err, httpResponse, body) => {
        if (err) {
          logger.error(err);
          reject(err);
          return;
        }
        if (typeof body === 'string') {
          body = JSON.parse(body);
        }
        if (!body.ok) {
          logger.error(body);
          reject(body);
        }
        returnValue.customEmoji = body.emoji;
        resolve(returnValue);
      });
    });
  }

  /**
   * 絵文字表現(:hoge:)が含まれた文字列を実際のえもじ(Unicode)に置き換えます。
   * カスタムえもじの場合は、imgタグに置き換えられます。
   *
   * @param target 絵文字化したい文字列
   * @return 絵文字化された文字列
   */
  emojify(target: string): string {
    target = escape_html(target);

    const onMissing = (name: string): string => {
      const result = this.getInternal(name);
      // もし取得できなかった場合はオリジナルの名前で還ります
      if (typeof result === 'string' && result[0] === ':') {
        return ':' + name + ':';
      }
      return result;
    }
    return NodeEmoji.emojify(target, onMissing);
  }

  /**
   * えもじを名前から取得します。
   *
   * @param name えもじの名前 (:が付いてない形式)
   * @return 絵文字表現
   */
  private getInternal(name: string): string {
    // まずデフォルトのえもじにあればそれを返します
    const defaultEmoji = NodeEmoji.get(name);
    if (defaultEmoji[0] !== ':') {
      return defaultEmoji;
    }
    // カスタムを調べます
    const custom = this.customEmoji[name];
    // カスタムになければ還ります
    if (!custom) {
      return ':' + name + ':';
    }
    // aliasだった場合は、再帰して取得します
    const aliasMatch = custom.match(/^alias:(.+)$/);
    if (aliasMatch) {
      return this.getInternal(aliasMatch[1]);
    }
    // aliasでない場合は画像へのURLなので、imgタグにして返します
    return `<img src="${custom}" alt=":${name}:" style="height:15px;width:15px;">`;
  }
}
