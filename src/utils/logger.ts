import * as fs from 'fs';
import * as path from 'path';
import * as log4js from 'log4js';

const log4jsConfig = (() => {
  const configPath = path.join(process.cwd(), './.times/log4js.config.json');
  if (fs.existsSync(configPath)) {
    return require(configPath);
  } else {
    return {
      appenders: {
        normal: { type: 'file', filename: '.times/times.log', maxLogSize: 10 * 1024 * 1024, compress: true }
      },
      categories: {
        default: { appenders: [ 'normal' ], level: 'debug' }
      }
    };
  }
})();
log4js.configure(log4jsConfig);
const exceptionLogger = log4js.getLogger('exception');
const accessLogger = log4js.getLogger('access');

const traceLoggerPerName: { [key: string]: any } = {};
function getTraceLogger(name: string): any {
  if (!traceLoggerPerName[name]) {
    traceLoggerPerName[name] = log4js.getLogger(name);
  }
  return traceLoggerPerName[name];
}

/**
 * times command 用のロガーオブジェクトです。
 * 次の機能があります。
 * - 例外をログ出力する。(see: error)
 * - アクセスログを出力する。(see: access)
 * - トレースログを出力場所ごとに名前をつけて出力する。(see: trace)
 */
export const logger = {
  /**
   * トレースログが有効になっているか調べます。
   * @param location 出力場所
   * @return 有効な場合 true
   */
  isTraceEnabled: function(location: string): boolean {
    return getTraceLogger(location).isTraceEnabled();
  },
  /**
   * トレースログを出力します。
   * @param location 出力場所
   * @param detail 出力するログ内容
   */
  trace: function(location: string, detail: any): void {
    getTraceLogger(location).trace(detail);
  },
  /**
   * アクセスログが有効になっているか調べます。
   * @return アクセスログが有効な場合 true
   */
  isAccessEnabeled: function(): boolean {
    return accessLogger.isDebugEnabled();
  },
  /**
   * アクセスログを出力します。
   * @param message スラックから渡されるMessageオブジェクト
   */
  access: function(message: any): void {
    if (!this.isAccessEnabeled() || !message) {
      return;
    }
    accessLogger.debug(`command: "${message.command}"\tinputed: "${message.text}"\tuser: ${message.user_id}\ttream: ${message.team_id}`);
  },
  /**
   * 例外のログを出力します。
   * @param ex 発生した例外
   */
  exception: function(ex: Error): void {
    this.error(ex);
  },
  /**
   * エラーログを出力します。
   * @param detail エラー詳細
   */
  error: function(detail: any): void {
    exceptionLogger.error(detail);
  }
};

/**
 * オブジェクトのコンストラクターの関数名またはクラス名を取得します。
 * @param obj 名前を知りたいオブジェクト
 */
function getName(obj: Object): string {
  if (!obj || !obj.constructor) {
    return '';
  }
  const sourceCode = obj.constructor.toString();
  if (sourceCode) {
    const matched = sourceCode.match(/[function|class][ ]+([a-zA-Z0-9_]+)/);
    return matched ? matched[1] : '';
  }
  return '';
}

/**
 * クラスのメンバー関数に開始と終了のトレースログを埋め込むためのdecoratorです。
 * @param target targetオブジェクト
 * @param propertyName デコレートされた関数の名前
 * @param descriptor デコレートされた関数のdescriptor
 */
export function withTrace(target: any, propertyName: string, descriptor: TypedPropertyDescriptor<Function>) {
  const method = descriptor.value;
  descriptor.value = () => {
    const targetName = getName(target);
    const traceName = targetName ? targetName + '.' + propertyName : propertyName;
    if (logger.isTraceEnabled(traceName)) {
      logger.trace(traceName, ['start', arguments]);
    }
    let returnValue;
    try {
      if (method) {
        returnValue = method.apply(this, arguments);
        return returnValue;
      }
    } finally {
      logger.trace(traceName, ['end', returnValue]);
    }
  };
}
