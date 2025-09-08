export declare function parseXml<T = any>(xml: string): Promise<T>;
export declare function buildXml(obj: any, options?: {
    rootName?: string;
    headless?: boolean;
    pretty?: boolean;
    indent?: string;
    newline?: string;
    standalone?: boolean;
}): string;
/** Small helpers to create simple Word elements (basic shapes to start) */
export declare function createWordParagraph(text: string): {
    'w:p': {
        'w:pPr': {
            'w:rPr': {};
        };
        'w:r': {
            'w:rPr': {};
            'w:t': string;
        };
    };
};
export declare function createWordTextElement(text: string): {
    'w:t': string;
};
