"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = __importDefault(require("../database"));
const plugins_1 = __importDefault(require("../plugins"));
const posts_1 = __importDefault(require("../posts"));
const terms = {
    day: 86400000,
    week: 604800000,
    month: 2592000000,
    year: 31104000000,
};
const Topics = {
    getRecentTopics: function (cid, uid, start, stop, filter) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.getSortedTopics({
                cids: cid,
                uid: uid,
                start: start,
                stop: stop,
                filter: filter,
                sort: 'recent',
            });
        });
    },
    getLatestTopics: function (options) {
        return __awaiter(this, void 0, void 0, function* () {
            const tids = yield this.getLatestTidsFromSet('topics:recent', options.start, options.stop, options.term);
            const topics = yield this.getTopics(tids, options);
            return { topics: topics, nextStart: options.stop + 1 };
        });
    },
    getLatestTidsFromSet: function (set, start, stop, term) {
        return __awaiter(this, void 0, void 0, function* () {
            let since = terms.day;
            if (terms[term]) {
                since = terms[term];
            }
            const count = parseInt(stop.toString(), 10) === -1 ? stop : stop - start + 1;
            const result = yield database_1.default.getSortedSetRevRangeByScore(set, start, count, '+inf', Date.now() - since);
            return Array.isArray(result) ? result : [];
        });
    },
    updateLastPostTimeFromLastPid: function (tid) {
        return __awaiter(this, void 0, void 0, function* () {
            const pid = yield this.getLatestUndeletedPid(tid);
            if (!pid) {
                return;
            }
            const timestamp = yield posts_1.default.getPostField(pid, 'timestamp');
            if (!timestamp) {
                return;
            }
            yield this.updateLastPostTime(tid, timestamp);
        });
    },
    updateLastPostTime: function (tid, lastposttime) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.setTopicField(tid, 'lastposttime', lastposttime);
            const topicData = yield this.getTopicFields(tid, ['cid', 'deleted', 'pinned']);
            yield database_1.default.sortedSetAdd(`cid:${topicData.cid}:tids:lastposttime`, lastposttime, tid);
            yield this.updateRecent(tid, lastposttime);
            if (!topicData.pinned) {
                yield database_1.default.sortedSetAdd(`cid:${topicData.cid}:tids`, lastposttime, tid);
            }
        });
    },
    updateRecent: function (tid, timestamp) {
        return __awaiter(this, void 0, void 0, function* () {
            let data = { tid: tid, timestamp: timestamp };
            if (plugins_1.default.hooks.hasListeners('filter:topics.updateRecent')) {
                data = (yield plugins_1.default.hooks.fire('filter:topics.updateRecent', { tid: tid, timestamp: timestamp }));
            }
            if (data && data.tid && data.timestamp) {
                yield database_1.default.sortedSetAdd('topics:recent', data.timestamp, data.tid);
            }
        });
    },
};
exports.default = Topics;
