/**
 * このファイルは各task共通の定義を行います。
 */

import { Context, RespondFn, SlashCommand } from "@slack/bolt";

/** タスクを表す関数の型定義です。 */
export type TaskFunction = (command: SlashCommand, respond: RespondFn, context: Context) => void;
