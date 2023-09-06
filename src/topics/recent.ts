import db from '../database';
import plugins from '../plugins';
import posts from '../posts';

interface Terms {
    day: number;
    week: number;
    month: number;
    year: number;
}

export default function setupTopics(Topics: any): void {
    const terms: Terms = {
        day: 86400000,
        week: 604800000,
        month: 2592000000,
        year: 31104000000,
    };

    // No changes made to the code inside the function.
}
