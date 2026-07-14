/** Initial open: enough turns to feel "instant" and usually overflow the viewport. */
export const INITIAL_CHAT_MESSAGE_PAGE_SIZE = 24;
/** Older history chunks while scrolling up (~12 turns). Edge-cached via Worker. */
export const OLDER_CHAT_MESSAGE_PAGE_SIZE = 24;
