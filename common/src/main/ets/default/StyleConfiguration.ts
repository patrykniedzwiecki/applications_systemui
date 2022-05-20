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

import StyleManager from './StyleManager';

const TAG = 'Common-StyleConfiguration';

export default class StyleConfiguration {
    static getCommonStyle() {
        const key: string = TAG + "-Common";
        return StyleManager.getStyle(key, () => {
            return {
                statusBarFontSize: '12fp',
                statusBarIconWidth: '24vp',
                statusBarIconHeight: '24vp',
                statusBarMarginLeftRight: '0vp',
            };
        });
    }
}