export type MoreStackParamList = {
  MoreMenu: undefined;
  FeatureDetail: { featureId: string };
};

export type RootTabParamList = {
  Accounts: undefined;
  /** `fromMore` is set when opening this tab from the More menu (shows back to More). */
  AgentChat: { fromMore?: boolean };
  /** `fromMore` is set when opening this tab from the More menu (shows back to More). */
  Transfers: { fromMore?: boolean };
  /** `fromMore` is set when opening this tab from the More menu (shows back to More). */
  Payments: { fromMore?: boolean };
  More: undefined;
};
