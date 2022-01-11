import { Context, SlashCommand } from '@slack/bolt';
import * as uuid from 'uuid';

/**
 * インタラクティブなやりとりでのコンテキストを表す型定義です。
 */
export type InteractiveContext = {
  id: string;
  actionName: string;
  command: SlashCommand;
  context: Context;
}

/**
 * インタラクティブなやりとりの際に、
 * ボタンなどSlack上でのやりとりでは、ボタンを押下したユーザ・チャネルなどのコンテキストはSlackのAPIによって渡されるが、
 * URL等を示してそこにアクセスしてもらう際には、URLに挿入したUUIDなどから操作元のユーザなどを知る必要があるため、
 * UUIDとコンテキストの関連を管理する必要があります。
 * このクラスはその管理を実現するためのクラスです。
 */
export class InteractiveContextManager {
  /** コンテキストの有効期限の定数定義（Hour）です。 */
  static readonly expirationPeriodHours = 6;
  /** 唯一のインスタンス。 */
  private static readonly _instance = new InteractiveContextManager();
  /** コンテキストの有効期限の定数定義（msec）です。この期間を過ぎるとコンテキストは破棄されます。 */
  readonly expirationPeriod = InteractiveContextManager.expirationPeriodHours * 60 * 60 * 1000;
  /** コンテキストを保持するオブジェクトです。 */
  contexts: { [id: string]: InteractiveContext} = {};

  /**
   * InteractiveContextManagerのインスタンスを取得します。
   *
   * @return InteractiveContextManagerのインスタンス
   */
  static getInstance(): InteractiveContextManager {
    return InteractiveContextManager._instance;
  }
  /**
   * コンストラクタです。
   * InteractiveContextManagerのインスタンスを生成します。
   * このコンストラクタはprivateのため外部からインスタンスの生成は行えません。
   */
  private constructor() {
  }
  /**
   * コンテキストを生成します。
   * 生成したコンテキストは内部に保持し、IDで後から取得できます。
   *
   * @param actionName アクション名。Slack上でボタンなどの表示を行う時の識別子となります。
   * @param command ボタンを表示する契機となったユーザ入力のオブジェクト。
   * @param context context
   * @return 生成したコンテキスト
   */
  createContext(actionName: string, command: SlashCommand, context: Context): InteractiveContext {
    const id = uuid.v4();
    this.contexts[id] = {
      id,
      actionName,
      command,
      context
    };
    setTimeout(() => {
      delete this.contexts[id];
    }, this.expirationPeriod);
    return this.contexts[id];
  }
  /**
   * コンテキストをIDで取得します。
   *
   * @param id ID
   * @return IDに対応するコンテキスト
   */
  getContext(id: string): InteractiveContext {
    return this.contexts[id];
  }
}
