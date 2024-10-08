'use strict';

export function customHeadingIdGenerator(node) {
    return node.textContent
        .toLowerCase()
        .replace(/[^\p{L}\p{N}-]/gu, '')
        .replace(/\s+/g, '')
        .trim();
}
