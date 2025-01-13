import * as vscode from 'vscode';
import * as fs from 'fs';
import { DebugThread } from './debugThread';
import { DebugFrame } from './debugFrame';
import { DebugEntity } from './variable/debugVariable';
import { ImageVariable } from './variable/imageVariable';

type IdType = number;
type TrackerId = IdType;
type TrackerName = string;

export class DebugSessionTracker {
    // tracker
    private _trackerId: TrackerId | undefined;
    public sessionName: TrackerName;
    private _session: vscode.DebugSession;
    public readonly context: vscode.ExtensionContext;;
    public readonly threads: DebugThread[] = [];
    public readonly debugStartDate: string;
    private _saveDirUri: vscode.Uri;
    public breakpoints: any[] = [];
    public static autoContinueEnable: boolean = false;
    public static autoConintueFrameName: string = "";

    public static breakCount: number = 0; // FIXME: manage brake count not by a static.

    // manage trackers
    private static _trackerIdCounter: number = 0;
    public static trackers: DebugSessionTracker[] = [];
    public static currentTracker: DebugSessionTracker | undefined = undefined;

    // constructor
    constructor(
        context: vscode.ExtensionContext,
        _session: vscode.DebugSession,
        _sessionName: string = "My Debug Session",
        _threads: DebugThread[] = [],
    ) {
        this.context = context;
        this._session = _session;
        this.sessionName = _sessionName;
        this.threads = _threads;
        this.breakpoints = [];

        // Get the current date and time
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth() + 1; // getMonth() is zero-based
        const day = now.getDate();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        const seconds = now.getSeconds();
        const milliseconds = now.getMilliseconds();

        const monthPadded = month.toString().padStart(2, '0');
        const dayPadded = day.toString().padStart(2, '0');
        const hoursPadded = hours.toString().padStart(2, '0');
        const minutesPadded = minutes.toString().padStart(2, '0');
        const secondsPadded = seconds.toString().padStart(2, '0');
        // Ensure milliseconds are three digits
        const millisecondsPadded = milliseconds.toString().padStart(3, '0');

        // Concatenate the parts with the desired format
        this.debugStartDate = `${year}-${monthPadded}-${dayPadded}_${hoursPadded}-${minutesPadded}-${secondsPadded}-${millisecondsPadded}`;

        // Set the save directory uri
        const session_dir_name = `Session_${this.session.id}`;
        if (context.storageUri !== undefined) {
            this._saveDirUri = vscode.Uri.joinPath(context.storageUri, session_dir_name);
        } else {
            this._saveDirUri = vscode.Uri.joinPath(context.globalStorageUri, `Session${_session.id}`);
        }
        // If not exist context.globalStorageUri directory, create directory
        ((dirpath: string) => {
            if (!fs.existsSync(dirpath)) {
                fs.mkdirSync(dirpath, { recursive: true });
            }

        })(this._saveDirUri.fsPath);
    };

    // getter
    public get session(): vscode.DebugSession {
        return this._session;
    }
    public get trackerId(): TrackerId | undefined {
        return this._trackerId;
    }
    public static getTrackerById(_trackerQuery: TrackerId): DebugSessionTracker | undefined {
        if (!DebugSessionTracker.trackers) {
            return undefined;
        } else {
            return DebugSessionTracker.trackers.find(tracker => tracker.trackerId === _trackerQuery);
        }
    }
    get saveDirUri(): vscode.Uri {
        return this._saveDirUri;
    }

    // factory
    public static newSessionTracker(context: vscode.ExtensionContext, _session: vscode.DebugSession): DebugSessionTracker {
        console.log("[DebugSessionTracker]", "Track new session", _session);

        // Create a new tracker
        let new_tracker = new DebugSessionTracker(context, _session);
        new_tracker.setNewTrackerId();

        // Add new tracker to the list of trackers
        DebugSessionTracker.trackers.push(new_tracker);
        DebugSessionTracker.currentTracker = new_tracker;
        console.log("[DebugSessionTracker]", "Created new tracker", new_tracker);

        return new_tracker;
    }
    public addThread(_threadId: IdType, _frames: DebugFrame[] = [], meta?: any): DebugThread {
        let thread = new DebugThread(this, _threadId, _frames, meta);
        this.threads.push(thread);
        return thread;
    }

    // internals
    private setNewTrackerId() {
        DebugSessionTracker._trackerIdCounter++;
        this._trackerId = DebugSessionTracker._trackerIdCounter;
    }

    // util
    public gatherAllVariables(): DebugEntity[] {
        let allVariables: DebugEntity[] = [];
        for (let thread of this.threads) {
            for (let frame of thread.frames) {
                // recursive gather
                let gather = (variable: DebugEntity) => {
                    allVariables.push(variable);
                    if (variable.value instanceof Array) {
                        variable.value.forEach((child: DebugEntity) => {
                            gather(child);
                        });
                    }
                };
                frame.variables.forEach((variable: DebugEntity) => {
                    gather(variable);
                });

                // gather for only first frame for debug
                // break; //FIXME: remove this line
            }
            // gather for only first thread for debug
            // break; //FIXME: remove this line
        }
        return allVariables;
    }

    gatherImageVariables(searched?: DebugEntity[], gathered?: ImageVariable[]): ImageVariable[] {
        if (searched === undefined) {
            searched = this.gatherAllVariables();
        }
        if (gathered === undefined) {
            gathered = [];
        }
        // recursive gather
        const imageVariables = searched.filter(
            (variable): variable is ImageVariable => variable instanceof ImageVariable
        );
        gathered.push(...imageVariables); // Add imageVariables to gathered

        for (let variable of imageVariables) {
            if (variable.value instanceof Array) {
                this.gatherImageVariables(variable.value, gathered);
            }
        }

        return gathered;
    }

    getSerializable() {
        return {
            trackerId: this.trackerId,
            session: this.sessionName,
            threads: this.threads.map(thread => thread.getSerializable())
        };
    }

    async continue() {
        const threadId = this.threads[0].id;
        await this.session.customRequest('continue', { threadId });
    }
    async stepOver() {
        const threadId = this.threads[0].id;
        await this.session.customRequest('next', { threadId });
    }
    async stepIn() {
        const threadId = this.threads[0].id;
        await this.session.customRequest('stepIn', { threadId });
    }
    async stepOut() {
        const threadId = this.threads[0].id;
        await this.session.customRequest('stepOut', { threadId });
    }
}

