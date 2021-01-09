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
        (value: string) => colors.blue(colors.bold(value)),
        (value: string) => colors.cyan(colors.bold(value)),
    ];

    if(head > headingFormats.length-1) {
        head = 0;
    }

    return headingFormats[head];
}

export function isMarkdownTable(text: string) {
    // https://github.com/erikvullings/slimdown-js/blob/master/src/slimdown.ts#L125
    return /(\|[^\n]+\|\r?\n)((?:\|\s*:?[-]+:?\s*)+\|)(\n(?:\|[^\n]+\|\r?\n?)*)?/g.test(text);
};

export function transformTable(markdownTable: string) {

    let grid = markdownTable
                .trim()
                .replaceAll('\r', '')
                .split('\n')
                .map(l => {return l.trim().replaceAll(/^\||\|$/g, '').split('|')});

    // console.log(grid);

    const maxCol = Math.max(...grid.map(row => row.length));

    for(let i = 0; i < maxCol; i++) {
        const cellMax = Math.max(...grid.map(row => colors.stripColor(row[i] || "").length));        

        // grid.map(row => row.map(cell => cell.padEnd(cellMax)));
        grid = grid.map(row => {
            const d = row;
            // add stipped length to padding
            const diff = d[i].length - colors.stripColor(d[i]).length;
            d[i] = (d[i]??'').padEnd(cellMax+diff);
            return d;
        });
    }

    // console.log(grid.map(row => "|" + row.join('|')).join('\n'));

    return grid.map(row => "|" + row.join('|') + "|").join('\n');
}

/*
export const prettifyTable = (mdt: string): string => {
    let parsedTable: string = marktable(mdt);

    let tableArray = parsedTable
        .trim()
        .split('\n')
        .map((s) =>
            s
                .split('|')
                .filter((c) => !c.includes('-'))
                .filter((d) => /\s+/.test(d))
        )
        .filter((e) => e.length > 1);

    const table = new Table({
        head: tableArray.shift(),
        chars: {
            top: '═',
            'top-mid': '╤',
            'top-left': '╔',
            'top-right': '╗',
            bottom: '═',
            'bottom-mid': '╧',
            'bottom-left': '╚',
            'bottom-right': '╝',
            left: '║',
            'left-mid': '╟',
            mid: '─',
            'mid-mid': '┼',
            right: '║',
            'right-mid': '╢',
            middle: '│',
        },
    });

    tableArray.forEach((e) => {
        table.push(e);
    });

    return table.toString();
};

export const highlightWithPrism = (code: string, language: string): string => {
    return highlight(code, language, {
        colors: {
            comment: '\x1B[38;2;107;114;128m',
            prolog: '\x1B[38;2;107;114;128m',
            doctype: '\x1B[38;2;107;114;128m',
            cdata: '\x1B[38;2;107;114;128m',
            punctuation: '\x1B[38;2;153;153;153m',
            property: '\x1B[38;2;153;0;85m',
            tag: '\x1B[38;2;153;0;85m',
            boolean: '\x1B[38;2;153;0;85m',
            number: '\x1B[38;2;153;0;85m',
            constant: '\x1B[38;2;153;0;85m',
            symbol: '\x1B[38;2;153;0;85m',
            deleted: '\x1B[38;2;153;0;85m',
            selector: '\x1B[38;2;16;185;129m',
            'attr-name': '\x1B[38;2;16;185;129m',
            string: '\x1B[38;2;16;185;129m',
            char: '\x1B[38;2;16;185;129m',
            builtin: '\x1B[38;2;16;185;129m',
            inserted: '\x1B[38;2;16;185;129m',
            operator: '\x1B[38;2;154;110;58m',
            entity: '\x1B[38;2;154;110;58m',
            url: '\x1B[38;2;154;110;58m',
            atrule: '\x1B[38;2;96;165;250m',
            'attr-value': '\x1B[38;2;96;165;250m',
            keyword: '\x1B[38;2;96;165;250m',
            function: '\x1B[38;2;221;74;104m',
            'class-name': '\x1B[38;2;221;74;104m',
            regex: '\x1B[38;2;238;153;0m',
            important: '\x1B[38;2;238;153;0m',
            variable: '\x1B[38;2;238;153;0m',
        },
    });
};
*/