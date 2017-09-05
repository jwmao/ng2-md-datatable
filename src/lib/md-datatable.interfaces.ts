import { DatatableSortType } from './md-datatable.enums';

// Redux inspired interfaces
export interface IDatatableAction {
  datatableId: string;
  type: string;
  payload?: any;
}

export interface IDatatableState {
  allRowsSelected: boolean;
  selectableValues: string[];
  selectedValues: string[];
  sortBy?: string;
  sortType: DatatableSortType;
}

export interface IDatatablesState {
  [datatableId: string]: IDatatableState;
}

export interface IDatatableReducer {
  reduce: (state: IDatatablesState, action: IDatatableAction) => IDatatablesState;
}

// Redux devtools proxy interfaces
export interface IReduxDevToolsConnection {
  init: (state: any) => void;
  send: (action: any, state: any, options?: Object, instanceId?: string) => void;
}

export interface IReduxDevToolsExtension {
  connect: (options: Object) => IReduxDevToolsConnection;
};
