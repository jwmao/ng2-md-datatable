import { DatatableSortType } from './md-datatable.enums';

export class IDatatableSelectionEvent {
  allRowsSelected: boolean;
  selectedValues: string[];
}

export class IDatatableSortEvent {
  sortBy?: string;
  sortType: DatatableSortType;
}

export class IDatatablePaginationEvent {
  page: number;
  itemsPerPage: number;
}
