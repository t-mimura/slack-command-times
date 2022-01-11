import { InstallationStore } from "@slack/bolt";
import { Store } from 'data-store';

const FILE_PATH = './.times/installation.json';
const localStore = new Store({
  path: FILE_PATH
});

export const myInstallationStore: InstallationStore = {
  storeInstallation: async (installation) => {
    if (installation.isEnterpriseInstall && installation.enterprise !== undefined) {
      // OrG 全体へのインストールに対応する場合
      localStore.set(installation.enterprise.id, installation);
      return;
    }
    if (installation.team !== undefined) {
      // 単独のワークスペースへのインストールの場合
      localStore.set(installation.team.id, installation);
      return;
    }
    throw new Error('Failed saving installation data to installationStore');
  },
  fetchInstallation: async (installQuery) => {
    if (installQuery.isEnterpriseInstall && installQuery.enterpriseId !== undefined) {
      // OrG 全体へのインストール情報の参照
      return localStore.get(installQuery.enterpriseId);
    }
    if (installQuery.teamId !== undefined) {
      // 単独のワークスペースへのインストール情報の参照
      return localStore.get(installQuery.teamId);
    }
    throw new Error('Failed fetching installation');
  },
  deleteInstallation: async (installQuery) => {
    if (installQuery.isEnterpriseInstall && installQuery.enterpriseId !== undefined) {
      // OrG 全体へのインストール情報の削除
      return localStore.del(installQuery.enterpriseId);
    }
    if (installQuery.teamId !== undefined) {
      // 単独のワークスペースへのインストール情報の削除
      return localStore.del(installQuery.teamId);
    }
    throw new Error('Failed to delete installation');
  }
};
