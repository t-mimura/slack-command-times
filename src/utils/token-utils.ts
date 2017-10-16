
export class TokenUtil {
  private static controller: any;

  static setController(controller: any) {
    TokenUtil.controller = controller;
  }

  /**
   * チームIDからTeam Creatorを取得し、そのユーザのトークンを取得します。
   *
   * @param teamId トークンを取得したいチームID
   */
  static getTeamCreatorToken(teamId: string): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!TokenUtil.controller) {
        reject();
        return;
      }
      TokenUtil.controller.storage.teams.get(teamId, (err, team) => {
        if (err) {
          reject(err);
          return;
        }
        const teamCreatorId: string = team.createdBy;
        TokenUtil.controller.storage.users.get(teamCreatorId, (err, user) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(user.access_token);
        });
      });
    });
  }
}
