/** Vertical rhythm between the blocks of a portal page. */
export const page = 'flex flex-col gap-10'

export const subtitle = 'mt-1.5 text-secondary'

/** Side column that stays 16px below the 118px sticky header. */
export const stickyAside = 'sticky top-33.5 hub-max-900:static'

export const serviceList = 'grid grid-cols-3 gap-x-4 gap-y-2 hub-max-900:grid-cols-2 hub-max-720:grid-cols-1'

/** Card text keeps clear of the illustration in the bottom-right corner. */
export const besideCornerArt = 'relative z-1 max-w-[max(calc(60%+2px),calc(100%-102px))] hub-max-720:max-w-[calc(100%-78px)]'

/** Main column with a 300px side column; one column below 900px. */
export const withAside = 'grid grid-cols-[minmax(0,1fr)_300px] items-start gap-9 hub-max-900:grid-cols-1'
