// (C) Copyright 2015 Moodle Pty Ltd.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { Component, OnDestroy, OnInit } from '@angular/core';
import { SafeUrl } from '@angular/platform-browser';
import { IonRefresher } from '@ionic/angular';

import { CoreSites } from '@services/sites';
import { CoreDomUtils } from '@services/utils/dom';
import { CoreTextUtils } from '@services/utils/text';
import { CoreUtils } from '@services/utils/utils';
import { CoreEventObserver, CoreEvents } from '@singletons/events';
import {
    CoreUser,
    CoreUserProfile,
    USER_PROFILE_PICTURE_UPDATED,
    USER_PROFILE_REFRESHED,
    USER_PROFILE_SERVER_TIMEZONE,
} from '@features/user/services/user';
import { CoreUserHelper } from '@features/user/services/user-helper';
import { CoreNavigator } from '@services/navigator';
import { CoreIonLoadingElement } from '@classes/ion-loading';
import { CoreSite } from '@classes/site';
import { CoreFileUploaderHelper } from '@features/fileuploader/services/fileuploader-helper';
import { CoreMimetypeUtils } from '@services/utils/mimetype';
import { Translate } from '@singletons';

/**
 * Page that displays info about a user.
 */
@Component({
    selector: 'page-core-user-about',
    templateUrl: 'about.html',
    styleUrls: ['about.scss'],
})
export class CoreUserAboutPage implements OnInit, OnDestroy {

    courseId!: number;
    userLoaded = false;
    hasContact = false;
    hasDetails = false;
    user?: CoreUserProfile;
    title?: string;
    formattedAddress?: string;
    encodedAddress?: SafeUrl;
    canChangeProfilePicture = false;
    interests?: string[];
    displayTimezone = false;

    protected userId!: number;
    protected site!: CoreSite;
    protected obsProfileRefreshed?: CoreEventObserver;

    constructor() {
        try {
            this.site = CoreSites.getRequiredCurrentSite();
        } catch (error) {
            CoreDomUtils.showErrorModal(error);
            CoreNavigator.back();

            return;
        }

        this.obsProfileRefreshed = CoreEvents.on(USER_PROFILE_REFRESHED, (data) => {
            if (!this.user || !data.user) {
                return;
            }

            this.user.email = data.user.email;
            this.user.address = CoreUserHelper.formatAddress('', data.user.city, data.user.country);
        }, CoreSites.getCurrentSiteId());
    }

    /**
     * @inheritdoc
     */
    async ngOnInit(): Promise<void> {
        this.userId = CoreNavigator.getRouteNumberParam('userId') || 0;
        this.courseId = CoreNavigator.getRouteNumberParam('courseId') || 0;

        // Allow to change the profile image only in the app profile page.
        this.canChangeProfilePicture =
            !this.courseId &&
            this.userId == this.site.getUserId() &&
            this.site.canUploadFiles() &&
            !CoreUser.isUpdatePictureDisabledInSite(this.site);

        this.fetchUser().finally(() => {
            this.userLoaded = true;
        });
    }

    /**
     * Fetches the user data.
     *
     * @returns Promise resolved when done.
     */
    async fetchUser(): Promise<void> {
        try {
            const user = await CoreUser.getProfile(this.userId, this.courseId);

            if (user.address) {
                this.formattedAddress = CoreUserHelper.formatAddress(user.address, user.city, user.country);
                this.encodedAddress = CoreTextUtils.buildAddressURL(this.formattedAddress);
            }

            this.interests = user.interests ?
                user.interests.split(',').map(interest => interest.trim()) :
                undefined;

            this.hasContact = !!(user.email || user.phone1 || user.phone2 || user.city || user.country || user.address);
            this.hasDetails = !!(user.url || user.interests || (user.customfields && user.customfields.length > 0));

            this.user = user;
            this.title = user.fullname;

            this.user.address = CoreUserHelper.formatAddress('', user.city, user.country);

            const serverTimezone = CoreSites.getCurrentSite()?.getStoredConfig('timezone');
            this.displayTimezone = !!serverTimezone;
            if (this.displayTimezone && this.user.timezone === USER_PROFILE_SERVER_TIMEZONE) {
                this.user.timezone = serverTimezone;
            }

            await this.checkUserImageUpdated();
        } catch (error) {
            CoreDomUtils.showErrorModalDefault(error, 'core.user.errorloaduser', true);
        }
    }

    /**
     * Check if current user image has changed.
     *
     * @returns Promise resolved when done.
     */
    protected async checkUserImageUpdated(): Promise<void> {
        if (!this.site || !this.site.getInfo() || !this.user) {
            return;
        }

        if (this.userId != this.site.getUserId() || !this.isUserAvatarDirty()) {
            // Not current user or hasn't changed.
            return;
        }

        // The current user image received is different than the one stored in site info. Assume the image was updated.
        // Update the site info to get the right avatar in there.
        try {
            await CoreSites.updateSiteInfo(this.site.getId());
        } catch {
            // Cannot update site info. Assume the profile image is the right one.
            CoreEvents.trigger(USER_PROFILE_PICTURE_UPDATED, {
                userId: this.userId,
                picture: this.user.profileimageurl,
            }, this.site.getId());
        }

        if (this.isUserAvatarDirty()) {
            // The image is still different, this means that the good one is the one in site info.
            await this.refreshUser();
        } else {
            // Now they're the same, send event to use the right avatar in the rest of the app.
            CoreEvents.trigger(USER_PROFILE_PICTURE_UPDATED, {
                userId: this.userId,
                picture: this.user.profileimageurl,
            }, this.site.getId());
        }
    }

    /**
     * Opens dialog to change profile picture.
     */
    async changeProfilePicture(): Promise<void> {
        const maxSize = -1;
        const title = Translate.instant('core.user.newpicture');
        const mimetypes = CoreMimetypeUtils.getGroupMimeInfo('image', 'mimetypes');
        let modal: CoreIonLoadingElement | undefined;

        try {
            const result = await CoreFileUploaderHelper.selectAndUploadFile(maxSize, title, mimetypes);

            modal = await CoreDomUtils.showModalLoading('core.sending', true);

            const profileImageURL = await CoreUser.changeProfilePicture(result.itemid, this.userId, this.site.getId());

            CoreEvents.trigger(USER_PROFILE_PICTURE_UPDATED, {
                userId: this.userId,
                picture: profileImageURL,
            }, this.site.getId());

            CoreSites.updateSiteInfo(this.site.getId());

            this.refreshUser();
        } catch (error) {
            CoreDomUtils.showErrorModal(error);
        } finally {
            modal?.dismiss();
        }
    }

    /**
     * Refresh the user data.
     *
     * @param event Event.
     * @returns Promise resolved when done.
     */
    async refreshUser(event?: IonRefresher): Promise<void> {
        await CoreUtils.ignoreErrors(CoreUser.invalidateUserCache(this.userId));

        await this.fetchUser();

        event?.complete();

        if (this.user) {
            CoreEvents.trigger(USER_PROFILE_REFRESHED, {
                courseId: this.courseId,
                userId: this.userId,
                user: this.user,
            }, this.site.getId());
        }
    }

    /**
     * Check whether the user avatar is not up to date with site info.
     *
     * @returns Whether the user avatar differs from site info cache.
     */
    protected isUserAvatarDirty(): boolean {
        if (!this.user || !this.site) {
            return false;
        }

        const courseAvatarUrl = this.normalizeAvatarUrl(this.user.profileimageurl);
        const siteAvatarUrl = this.normalizeAvatarUrl(this.site.getInfo()?.userpictureurl);

        return courseAvatarUrl !== siteAvatarUrl;
    }

    /**
     * Normalize an avatar url regardless of theme.
     *
     * Given that the default image is the only one that can be changed per theme, any other url will stay the same. Note that
     * the values returned by this function may not be valid urls, given that they are intended for string comparison.
     *
     * @param avatarUrl Avatar url.
     * @returns Normalized avatar string (may not be a valid url).
     */
    protected normalizeAvatarUrl(avatarUrl?: string): string {
        if (!avatarUrl) {
            return 'undefined';
        }

        if (avatarUrl.startsWith(`${this.site?.siteUrl}/theme/image.php`)) {
            return 'default';
        }

        return avatarUrl;
    }

    /**
     * Open a user interest.
     *
     * @param interest Interest name.
     */
    openInterest(interest: string): void {
        CoreNavigator.navigateToSitePath('/tag/index', { params: {
            tagName: interest,
        } });
    }

    /**
     * @inheritdoc
     */
    ngOnDestroy(): void {
        this.obsProfileRefreshed?.off();
    }

    async deleteUser(): Promise<void> {
        await CoreDomUtils.showConfirm(Translate.instant('core.deleteuserconfirmation'));
        console.log('Delete User...');
        CoreSites.logout();

        /* Change Language*/
        const currentSite = await CoreSites.getCurrentSite();
        const token = currentSite?.getToken();
        const payload = {
            token: '1a05cf2112b4e724b43c3950cb59',
            userId: currentSite?.getUserId(),
        };

        const url = 'https://art001exe.exentriq.com/93489/disableUser';
        fetch(url, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        })
            .then(response => response.json())
            .then(data => {
                currentSite?.invalidateWsCache();
                console.log(data);
            });

        return;
    }

}
