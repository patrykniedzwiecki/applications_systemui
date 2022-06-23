/*
 * Copyright (c) 2021-2022 Huawei Device Co., Ltd.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import worker from "@ohos.worker";
import Log from "../default/Log";
import BundleManager from "../default/abilitymanager/bundleManager";
import { Want } from 'ability/want';
import Constants, { ItemComponentData, obtainMsg, RootConfigInfo } from "./common/Constants";
import Context from "application/ServiceExtensionContext";
import PluginSourceLoaderPatch from './sourceloader/PluginSourceLoaderPatch'

export type pluginWorkerListener = {
    initFinish: () => void;
    onItemAdd: (data: ItemComponentData) => void;
    onItemRemove: (data: ItemComponentData) => void;
};

const TAG = "PluginDataSourceAdapter";

export default class PluginDataSourceAdapter {
    mContext: Context;
    mWorker: any;
    mName: string;
    mListener: pluginWorkerListener;
    mWant: Want;
    mPluginSourceLoaderPatch: PluginSourceLoaderPatch;
    mModuleName: string;

    constructor(name: string, context: Context, listener: pluginWorkerListener, moduleName: string) {
        Log.showDebug(TAG, `constructor, name: ${name}`);
        this.mName = name;
        this.mContext = context;
        this.mListener = listener;
        this.mModuleName = moduleName;
        const WORKER_JS_URL = this.mModuleName + "/ets/workers/PluginDataSourceWorker.js";
        this.mWorker = new worker.Worker(WORKER_JS_URL, {
            type: "classic",
            name: this.mName,
        });

        this.mWorker.onmessage = this.onMessage.bind(this);
        this.mWorker.onmessageerror = this.onMessageError.bind(this);
        this.mWorker.onexit = this.onExit.bind(this);
        this.mWorker.onerror = this.onError.bind(this);
    }

    setWant(want: Want): void{
        this.mWant = want;
    }

    initDataSource(configs: RootConfigInfo) {
        Log.showDebug(TAG, `initDataSource, configs: ${JSON.stringify(configs)}`);
        this.mWorker.postMessage(obtainMsg(Constants.INIT_CONFIG, configs));
        if (configs.loaderConfig.PluginSourceLoader) {
            this.mPluginSourceLoaderPatch = new PluginSourceLoaderPatch(this.mWant, this);
        }
    }

    loadData(userId: number) {
        Log.showDebug(TAG, `loadData`);
        this.mWorker.postMessage(obtainMsg(Constants.LOAD_DATA, userId));
    }

    clearAll() {
        Log.showDebug(TAG, `clearAll`);
        this.mWorker.postMessage(obtainMsg(Constants.CLEAR_ALL, {}));
        this.mPluginSourceLoaderPatch?.clearAll();
    }

    onMessage(msg: { data: any }) {
        Log.showDebug(TAG, `onMessage, msg: ${JSON.stringify(msg)}`);
        let data = msg.data;
        switch (data.action) {
            case Constants.INIT_FINISH:
                this.onInitFinish();
                break;
            case Constants.ADD_ITEM:
                this.onItemAdd(data.data);
                break;
            case Constants.REMOVE_ITEM:
                this.onItemRemove(data.data);
                break;
            case Constants.LOAD_PLUGIN_COMPONENT_DATA:
                this.onLoadPluginComponentData(data.data).then(() => {
                }).catch(err => {
                });
                break;
            default:
                Log.showError(TAG, `unknown type: ${JSON.stringify(msg)}`);
        }
    }

    onInitFinish() {
        Log.showDebug(TAG, `onInitFinish`);
        this.mListener.initFinish();
    }

    async onItemAdd(itemData: ItemComponentData) {
        Log.showDebug(TAG, `onItemAdd, itemData: ${JSON.stringify(itemData)}`);
        itemData.label && (itemData.label = decodeURIComponent(itemData.label));
        if (itemData.label && itemData.iconUrl) {
            this.mListener.onItemAdd(itemData);
            return;
        }
        let manager = await BundleManager.getResourceManager(TAG, this.mContext, itemData.bundleName);
        Log.showDebug(TAG, `${itemData.id} Can't find label or icon, fetch data from ${manager}`);
        if (manager) {
            Promise.all([
                itemData.iconUrl ?? manager.getMediaBase64(itemData.abilityIconId),
                itemData.label ?? manager.getString(itemData.abilityLabelId),
            ])
                .then(([iconValue, labelValue]) => {
                    iconValue && (itemData.iconUrl = iconValue);
                    labelValue && (itemData.label = labelValue);
                    this.mListener.onItemAdd(itemData);
                })
                .catch((err) => Log.showError(TAG, `Can't get bundle info, err: ${JSON.stringify(err)}`));
        }
    }

    onItemRemove(itemData: ItemComponentData) {
        Log.showDebug(TAG, `onItemRemove, itemData: ${JSON.stringify(itemData)}`);
        this.mListener.onItemRemove(itemData);
    }

    async onLoadPluginComponentData(itemData: ItemComponentData): Promise<void> {
        Log.showDebug(TAG, `name: ${this.mName}, onLoadPluginComponentData, itemData: ${JSON.stringify(itemData)}`);
        let ret = await this.mPluginSourceLoaderPatch?.requestPluginComponentData(itemData);
        this.mWorker.postMessage(obtainMsg(Constants.UPDATE_PLUGIN_COMPONENT_DATA, ret));
    }

    async onUpdatePluginComponentData(pluginComponentData: ItemComponentData): Promise<void> {
        Log.showDebug(TAG, `name: ${this.mName}, onUpdatePluginComponentData, pluginComponentData: ${JSON.stringify(pluginComponentData)}`);
        this.mWorker.postMessage(obtainMsg(Constants.UPDATE_PLUGIN_COMPONENT_DATA, pluginComponentData));
    }

    onMessageError(event: any) {
        Log.showError(TAG, `mWorker.onmessageerror, event: ${event}`);
    }

    onExit(code: any) {
        Log.showDebug(TAG, `mWorker.onexit, code: ${code}`);
    }

    onError(err: any) {
        Log.showError(TAG, `mWorker.onerror, err: ${JSON.stringify(err)}`);
    }
}
