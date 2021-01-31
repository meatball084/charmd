/* import unified from 'unified';
import parser from 'remark-parse';
import stringify from 'remark-stringify';
import marktable from 'marktable';
import Table from 'cli-table';
import Axios from 'axios';
import highlight from 'prism-cli'; */

import { colors, fromMarkdown } from './deps.ts';

export type Node = {
    type: string;
    value: any;
    children?: Node[];
    kind?: string;
    ordered?: boolean;
    tabed?: boolean;
    depth?: number;
    url?: string;
    alt?: string;
    lang?: string;
    label?: string;
    title?: string;
    listLevel?: number;
    start?: number; // ordered list
    spread?: boolean; // list
};

function polyfillDocumentCreateForMDAST() {
    // https://github.com/wooorm/parse-entities/blob/main/decode-entity.browser.js#L15
    // happens eg when text contains: [ &mdash; ]
    const prev = (globalThis as any).document;
    (globalThis as any).document = {
        createElement: (...data: any[]) => {
            return new class {
                set innerHTML(data: string) {this.textContent = data};
                textContent = '';
            }();
        }
    };
    return prev;
}

/**
 * Returns an AST of the provided markdown.
 * It is a basic wrapper around https://github.com/syntax-tree/mdast-util-from-markdown,
 * `encoding` and `options` are passed straight to its `fromMarkdown` function
 */
export function toAst(markdown: string, encodig?: any, options?: {extensions?: any[], mdastExtensions?: any[]}): Node {
    const prevDocument = polyfillDocumentCreateForMDAST();
    const value = fromMarkdown(markdown, encodig, options);
    
    // just to be safer
    (globalThis as any).document = prevDocument;

    return value;
};

export function getHeaderFormatter(head: number) {
    const headingFormats = [
        (value: string) => value,
        (value: string) => colors.bold(colors.underline(colors.red(value))),
        (value: string) => colors.yellow(colors.bold(value)),
        (value: string) => colors.green(colors.bold(value)),
        (value: string) => colors.magenta(colors.bold(value)),
        (value: string) => colors.cyan(colors.bold(value)),
        (value: string) => colors.blue(colors.bold(value)),
    ];

    if(head > headingFormats.length-1) {
        head = 0;
    }

    return headingFormats[head];
}

export function isMarkdownTable(text: string) {
    // https://github.com/erikvullings/slimdown-js/blob/master/src/slimdown.ts#L125
    // Added \s* for the alignment row
    return /(\|[^\n]+\|\r?\n)((?:\|\s*:?[-]+:?\s*)+\|)(\n(?:\|[^\n]+\|\r?\n?)*)?/g.test(text);
};

export function transformTable(markdownTable: string, borders?: boolean) {

    let grid = markdownTable
                .trim()
                .replaceAll('\r', '')
                .split('\n')
                .map(l => { return (
                    l
                    .trim()
                    // remove first and last "|" borders of the table
                    .replaceAll(/^\||\|$/g, '')
                    .split('|')
                )});

    const maxCol = Math.max(...grid.map(row => row.length));
    const cellWidths = [];
    
    const cellPadding = 1;
    const paddingString = " ".repeat(cellPadding);

    for(let i = 0; i < maxCol; i++) {
        // if second row/alingment row, ignore it's length
        const cellMax = Math.max(...grid.map((row, ri) => colors.stripColor(ri === 1 ? "" : (row[i] || "").trim()).length));        
        cellWidths.push(cellMax);

        const align = grid[1][i]?.trim() || ':--'; // defaults to left, to give chance to render markdown, not to throw
        const cellAlign = align.startsWith(':') ? (align.endsWith(':') ? 'center' : 'left') : (align.endsWith(':') ? 'right' : 'left');
        // grid.map(row => row.map(cell => cell.padEnd(cellMax)));
        grid = grid.map((row, ri) => {
            const d = row;
            if(ri === 1) { // to fill rowalignment-lint to cellMax
                d[i] = `${['center', 'left'].includes(cellAlign) ? ':' : ''}${"-".repeat(cellMax + cellPadding*2 - (cellAlign === 'center'? 2 : 1))}${['center', 'right'].includes(cellAlign) ? ':' : ''}`;
                return d;
            }

            let cellContent = (d[i] || '').trim();
            if(borders && ri === 0) {
                cellContent = colors.blue(colors.bold(cellContent));
            }
            // add stipped length to padding
            const strippedDiff = cellContent.length - colors.stripColor(cellContent).length;
            const diff = (cellMax - cellContent.length) + strippedDiff;
            d[i] = paddingString + getAlignedCellText(cellContent, cellAlign, diff) + paddingString;
            return d;
        });
    }

    if(borders) {
        // console.log(grid.map(row => "|" + row.join('|')).join('\n'));
        const top = tableChars.topLeft + cellWidths.map(cw => tableChars.middleMiddle.repeat(cw + cellPadding*2)).join(tableChars.topMiddle) + tableChars.topRight;
        const middle = tableChars.leftMiddle + cellWidths.map(cw => tableChars.middleMiddle.repeat(cw + cellPadding*2)).join(tableChars.rowMiddle) + tableChars.rightMiddle;
        const bottom = tableChars.bottomLeft + cellWidths.map(cw => tableChars.middleMiddle.repeat(cw + cellPadding*2)).join(tableChars.bottomMiddle) + tableChars.bottomRight;

        grid.splice(1, 1); // remove alignment row
        return (
            top + '\n'
            + grid.map(row => tableChars.left + row.join(tableChars.middle) + tableChars.right).join('\n'+middle+'\n') + '\n'
            + bottom
        );
    } else {
        return grid.map(row => "|" + row.join("|") + "|").join('\n');
    }
    
}

function getAlignedCellText(cellText: string, align: string, diff: number) {
    diff = Math.max(diff, 0); // TODO fix, so no negative comes in in the first place
    switch(align) {
        case 'center':
            return " ".repeat(Math.floor(diff/2)) + cellText + " ".repeat(Math.ceil(diff/2));
        case 'left':
            return cellText + " ".repeat(diff);
        case 'right':
            return " ".repeat(diff) + cellText;
    }
}

const tableChars = {
    middleMiddle: "─",
    rowMiddle: "┼",
    topRight: "┐",
    topLeft: "┌",
    leftMiddle: "├",
    topMiddle: "┬",
    bottomRight: "┘",
    bottomLeft: "└",
    bottomMiddle: "┴",
    rightMiddle: "┤",
    left: "│",
    right: "│",
    middle: "│",
};