import db from '../database';
import plugins from '../plugins';
import posts from '../posts';

interface TopicData {
    cid: string;
    deleted: boolean;
    pinned: boolean;
}

interface TopicsInterface {
    getRecentTopics(cid: number, uid: number, start: number, stop: number, filter: string): Promise<object>;
    getLatestTopics(options: {start: number, stop: number, term: string}):
        Promise<{ topics: object; nextStart: number }>;
    getLatestTidsFromSet(set: string, start: number, stop: number, term: string): Promise<Array<number>>;
    updateLastPostTimeFromLastPid(tid: string): Promise<void>;
    updateLastPostTime(tid: string, lastposttime: number): Promise<void>;
    updateRecent(tid: string, timestamp: number): Promise<void>;
}

interface ThisType {
    getSortedTopics(arg: object): Promise<object>;
    getLatestTidsFromSet(set: string, start: number, stop: number, term: string): Promise<Array<number>>;
    getTopics(tids: Array<number>, options: {start: number, stop: number, term: string}): Promise<object>;
    setTopicField(tid: string, field: string, value: string | number | boolean): Promise<void>;
    getTopicFields(tid: string, fields: Array<string>): Promise<TopicData>;
    updateRecent(tid: string, lastposttime: number): Promise<void>;
    getLatestUndeletedPid(tid: string): Promise<number | undefined>;
    updateLastPostTime(tid: string, lastposttime: number): Promise<void>;

}

interface DBType {
    getSortedSetRevRangeByScore(set: string, start: number, count: number,
        max: string, min: number): Promise<Array<number>>;
    sortedSetAdd(set: string, score: number, value: string): Promise<void>;
}

interface PostsType {
    getPostField(pid: number, field: string): Promise<number | undefined>;
}

interface PluginsType {
    hooks: {
        hasListeners(event: string): boolean;
        fire(event: string, data: object): Promise<object>;
    };
}

const terms = {
    day: 86400000,
    week: 604800000,
    month: 2592000000,
    year: 31104000000,
};

const Topics: TopicsInterface = {
    getRecentTopics: async function (this: ThisType, cid: number, uid: number, start: number, stop: number,
        filter: string): Promise<object> {
        return await this.getSortedTopics({
            cids: cid,
            uid: uid,
            start: start,
            stop: stop,
            filter: filter,
            sort: 'recent',
        });
    },

    getLatestTopics: async function (this: ThisType, options: {start: number,
        stop: number, term: string}): Promise<{ topics: object; nextStart: number }> {
        const tids: Array<number> = await this.getLatestTidsFromSet('topics:recent', options.start, options.stop, options.term);
        const topics: object = await this.getTopics(tids, options);
        return { topics: topics, nextStart: options.stop + 1 };
    },

    getLatestTidsFromSet: async function (set: string, start: number, stop: number,
        term: string): Promise<Array<number>> {
        let since = terms.day;
        if (terms[term]) {
            since = terms[term as keyof typeof terms];
        }

        const count = parseInt(stop.toString(), 10) === -1 ? stop : stop - start + 1;
        const result: Array<number> = await (db as DBType).getSortedSetRevRangeByScore(set, start, count, '+inf', Date.now() - since);
        return Array.isArray(result) ? result : [];
    },

    updateLastPostTimeFromLastPid: async function (this: ThisType, tid: string): Promise<void> {
        const pid: number | undefined = await this.getLatestUndeletedPid(tid);
        if (!pid) {
            return;
        }
        const timestamp: number | undefined = await (posts as PostsType).getPostField(pid, 'timestamp');
        if (!timestamp) {
            return;
        }
        await this.updateLastPostTime(tid, timestamp);
    },

    updateLastPostTime: async function (this: ThisType, tid: string, lastposttime: number) {
        await this.setTopicField(tid, 'lastposttime', lastposttime);
        const topicData: TopicData = await this.getTopicFields(tid, ['cid', 'deleted', 'pinned']);

        await (db as DBType).sortedSetAdd(`cid:${topicData.cid}:tids:lastposttime`, lastposttime, tid);

        await this.updateRecent(tid, lastposttime);

        if (!topicData.pinned) {
            await (db as DBType).sortedSetAdd(`cid:${topicData.cid}:tids`, lastposttime, tid);
        }
    },

    updateRecent: async function (this: ThisType, tid: string, timestamp: number): Promise<void> {
        let data: { tid: string, timestamp: number } = { tid: tid, timestamp: timestamp };
        if ((plugins as PluginsType).hooks.hasListeners('filter:topics.updateRecent')) {
            data = await (plugins as PluginsType).hooks.fire('filter:topics.updateRecent', { tid: tid, timestamp: timestamp }) as { tid: string, timestamp: number };
        }
        if (data && data.tid && data.timestamp) {
            await (db as DBType).sortedSetAdd('topics:recent', data.timestamp, data.tid);
        }
    },
};

function exportTopics(): TopicsInterface {
    return Topics;
}

export = exportTopics;
