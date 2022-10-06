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

import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { IonRefresher } from '@ionic/angular';
import { Params } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

import { CoreSite, CoreSiteConfig } from '@classes/site';
import { CoreCourse, CoreCourseModuleBasicInfo, CoreCourseWSSection } from '@features/course/services/course';
import { CoreDomUtils } from '@services/utils/dom';
import { CoreSites } from '@services/sites';
import { CoreSiteHome } from '@features/sitehome/services/sitehome';
import { CoreCourses, CoreCoursesProvider } from '@features//courses/services/courses';
import { CoreEventObserver, CoreEvents } from '@singletons/events';
import { CoreCourseHelper, CoreCourseModule } from '@features/course/services/course-helper';
import { CoreBlockCourseBlocksComponent } from '@features/block/components/course-blocks/course-blocks';
import { CoreCourseModuleDelegate, CoreCourseModuleHandlerData } from '@features/course/services/module-delegate';
import { CoreCourseModulePrefetchDelegate } from '@features/course/services/module-prefetch-delegate';
import { CoreNavigator } from '@services/navigator';
import { CoreUtils } from '@services/utils/utils';
import { CoreLoginSiteBadgesComponent } from './site-badges/site-badges';
import { Translate } from '@singletons';
import { CoreLang } from '@services/lang';
import { CoreForms } from '@singletons/form';

/**
 * Page that displays site home index.
 */
@Component({
    selector: 'page-core-sitehome-index',
    templateUrl: 'index.html',
})
export class CoreSiteHomeIndexPage implements OnInit, OnDestroy {

    @ViewChild(CoreBlockCourseBlocksComponent) courseBlocksComponent?: CoreBlockCourseBlocksComponent;

    dataLoaded = false;
    section?: CoreCourseWSSection & {
        hasContent?: boolean;
    };
	
	couponForm!: FormGroup;
	instructorForm!: FormGroup;
    hasContent = false;
    items: string[] = [];
    siteHomeId = 1;
    currentSite?: CoreSite;
    searchEnabled = false;
    downloadEnabled = false;
    downloadCourseEnabled = false;
    downloadCoursesEnabled = false;
    downloadEnabledIcon = 'far-square';
    newsForumModule?: NewsForum;

    protected updateSiteObserver?: CoreEventObserver;
	
	constructor(
        protected fb: FormBuilder,
    ) {}
    
    /**
     * Page being initialized.
     */
    ngOnInit(): void {
	    var codenotvalid = Translate.instant('home.codenotvalid');
	    var teachernotvalid = Translate.instant('home.teachernotvalid');
	    
        this.searchEnabled = !CoreCourses.isSearchCoursesDisabledInSite();
        this.downloadCourseEnabled = !CoreCourses.isDownloadCourseDisabledInSite();
        this.downloadCoursesEnabled = !CoreCourses.isDownloadCoursesDisabledInSite();

        // Refresh the enabled flags if site is updated.
        this.updateSiteObserver = CoreEvents.on(CoreEvents.SITE_UPDATED, () => {
            this.searchEnabled = !CoreCourses.isSearchCoursesDisabledInSite();
            this.downloadCourseEnabled = !CoreCourses.isDownloadCourseDisabledInSite();
            this.downloadCoursesEnabled = !CoreCourses.isDownloadCoursesDisabledInSite();

            this.switchDownload(this.downloadEnabled && this.downloadCourseEnabled && this.downloadCoursesEnabled);
        }, CoreSites.getCurrentSiteId());
        
        this.couponForm = this.fb.group({
            coursecode: ['', Validators.required]
        });

		this.instructorForm = this.fb.group({
            courseinstructor: ['', Validators.required]
        });


        this.currentSite = CoreSites.getCurrentSite()!;
        this.siteHomeId = CoreSites.getCurrentSiteHomeId();

        const module = CoreNavigator.getRouteParam<CoreCourseModule>('module');
        if (module) {
            const modParams = CoreNavigator.getRouteParam<Params>('modParams');
            CoreCourseHelper.openModule(module, this.siteHomeId, undefined, modParams);
        }
        
		//Init Lang
		CoreLang.getCurrentLanguage().then((lang) => {
			console.log(`0...Init Lang `, lang);
			const token = this.currentSite?.getToken();
			const payload = {
				token,
				lang,
				userId: this.currentSite?.getUserId(),
			};
			const url = 'https://art001exe.exentriq.com/93489/updateLanguage';
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
					console.log("Update Language ",lang);
				});
		});
		
        this.loadContent().finally(() => {
            this.dataLoaded = true;
            
            
            
            setTimeout(function(){
	            
	            //added oct 2022, hide web part
	            var step1 = document.querySelector<HTMLElement>("#step1");
				if(step1 != null)
					step1.style.display = "none";
				
	        
		        var mobileareas = document.querySelector<HTMLElement>(".mobile-only-area");
	            if(mobileareas != null){
		            mobileareas.style.display = "block";
		            }
		            
		        var pleaseUpgrade = document.querySelector<HTMLElement>("#pleaseUpgrade");
				  	if(pleaseUpgrade != null){
		            	pleaseUpgrade.style.display = "none";
		            }
		            
		        var showAfterUpgrade = document.querySelector<HTMLElement>("#showAfterUpgrade");
					if(showAfterUpgrade != null){
		            	showAfterUpgrade.style.display = "none";
		            }
		        
	        
			},2000)
        });
        
        
    }

    /**
     * Convenience function to fetch the data.
     *
     * @return Promise resolved when done.
     */
    protected async loadContent(): Promise<void> {
        this.hasContent = false;

        const config = this.currentSite!.getStoredConfig() || { numsections: 1, frontpageloggedin: undefined };

        this.items = await CoreSiteHome.getFrontPageItems(config.frontpageloggedin);
        this.hasContent = this.items.length > 0;

        if (this.items.some((item) => item == 'NEWS_ITEMS')) {
            // Get the news forum.
            try {
                const forum = await CoreSiteHome.getNewsForum();
                this.newsForumModule = await CoreCourse.getModuleBasicInfo(forum.cmid);
                this.newsForumModule.handlerData = CoreCourseModuleDelegate.getModuleDataFor(
                    this.newsForumModule.modname,
                    this.newsForumModule,
                    this.siteHomeId,
                    this.newsForumModule.section,
                    true,
                );
            } catch {
                // Ignore errors.
            }
        }

        try {
            const sections = await CoreCourse.getSections(this.siteHomeId!, false, true);

            // Check "Include a topic section" setting from numsections.
            this.section = config.numsections ? sections.find((section) => section.section == 1) : undefined;
            if (this.section) {
                const result = CoreCourseHelper.addHandlerDataForModules(
                    [this.section],
                    this.siteHomeId,
                    undefined,
                    undefined,
                    true,
                );
                this.hasContent = result.hasContent || this.hasContent;
            }

            // Add log in Moodle.
            CoreCourse.logView(
                this.siteHomeId!,
                undefined,
                undefined,
                this.currentSite!.getInfo()?.sitename,
            ).catch(() => {
                // Ignore errors.
            });
        } catch (error) {
            CoreDomUtils.showErrorModalDefault(error, 'core.course.couldnotloadsectioncontent', true);
        }
    }

    /**
     * Refresh the data.
     *
     * @param refresher Refresher.
     */
    doRefresh(refresher?: IonRefresher): void {
        const promises: Promise<unknown>[] = [];

        promises.push(CoreCourse.invalidateSections(this.siteHomeId!));
        promises.push(this.currentSite!.invalidateConfig().then(async () => {
            // Config invalidated, fetch it again.
            const config: CoreSiteConfig = await this.currentSite!.getConfig();
            this.currentSite!.setConfig(config);

            return;
        }));

        if (this.section && this.section.modules) {
            // Invalidate modules prefetch data.
            promises.push(CoreCourseModulePrefetchDelegate.invalidateModules(this.section.modules, this.siteHomeId));
        }

        if (this.courseBlocksComponent) {
            promises.push(this.courseBlocksComponent.invalidateBlocks());
        }

        Promise.all(promises).finally(async () => {
            const p2: Promise<unknown>[] = [];

            p2.push(this.loadContent());
            if (this.courseBlocksComponent) {
                p2.push(this.courseBlocksComponent.loadContent());
            }

            await Promise.all(p2).finally(() => {
                refresher?.complete();
                
                console.log("promise end");
                
                setTimeout(function(){
	                
	                	var codeSection = document.querySelector<HTMLElement>("#SectionChechCourseCode");
			            if(codeSection != null)
			            	codeSection.style.display = "block";
	        
			       		var mobileareas = document.querySelector<HTMLElement>(".mobile-only-area");
				   		if(mobileareas != null){
				   		 	mobileareas.style.display = "block";
			            }
			            
			            var pleaseUpgrade = document.querySelector<HTMLElement>("#pleaseUpgrade");
						if(pleaseUpgrade != null){
			            	pleaseUpgrade.style.display = "none";
			            }
			            
			            var showAfterUpgrade = document.querySelector<HTMLElement>("#showAfterUpgrade");
						if(showAfterUpgrade != null){
			            	showAfterUpgrade.style.display = "none";
			            }
			            
			    
						},2000)
                
            });
            
        });
    }

    /**
     * Toggle download enabled.
     */
    toggleDownload(): void {
        this.switchDownload(!this.downloadEnabled);
    }

    /**
     * Convenience function to switch download enabled.
     *
     * @param enable If enable or disable.
     */
    protected switchDownload(enable: boolean): void {
        this.downloadEnabled = (this.downloadCourseEnabled || this.downloadCoursesEnabled) && enable;
        this.downloadEnabledIcon = this.downloadEnabled ? 'far-check-square' : 'far-square';
        CoreEvents.trigger(CoreCoursesProvider.EVENT_DASHBOARD_DOWNLOAD_ENABLED_CHANGED, { enabled: this.downloadEnabled });
    }

    /**
     * Open page to manage courses storage.
     */
    manageCoursesStorage(): void {
        CoreNavigator.navigateToSitePath('/storage');
    }

    /**
     * Go to search courses.
     */
    openSearch(): void {
        CoreNavigator.navigateToSitePath('courses/search');
    }

    /**
     * Go to available courses.
     */
    openAvailableCourses(): void {
        CoreNavigator.navigateToSitePath('courses/all');
    }

    /**
     * Go to my courses.
     */
    openMyCourses(): void {
        CoreNavigator.navigateToSitePath('courses/my');
    }

    /**
     * Go to course categories.
     */
    openCourseCategories(): void {
        CoreNavigator.navigateToSitePath('courses/categories');
    }

    /**
     * Component being destroyed.
     */
    ngOnDestroy(): void {
        this.updateSiteObserver?.off();
    }
    
     /**
     * Validate coupon.
     */
    async validateCoupon(e?: Event): Promise<void> {
	    
	    var step1 = document.querySelector<HTMLElement>("#step1native");
		if(step1 != null)
			step1.style.display = "none";
				 	
	    const coursecode = this.couponForm.value.coursecode;
	     
	    const url = "https://art001exe.exentriq.com/93489/isValidCode?code=" + coursecode.replace("-","") + "&rand=" + new Date().getTime();
				
		fetch(url, {
			method: 'GET',
			headers: {
				'Accept': 'application/json',
				'Content-Type': 'application/json',
			}
		})
			.then(response => response.json())
			.then(data => {
				console.log("Valid ",data);
				
				if(data.valid){
					
					window["courseId"] = data.id;
					window["couponId"] = data.coupon;
					
					var step2 = document.querySelector<HTMLElement>("#step2native");
					if(step2 != null)
						step2.style.display = "block";
					
					var courseLabel = document.querySelector<HTMLElement>("#course-label-name-native");
					if(courseLabel != null)
						courseLabel.innerHTML = data.title;
					
				}else{
					CoreDomUtils.showErrorModal(Translate.instant('core.course.not_valid'));	
					if(step1 != null)
						step1.style.display = "block";
				}
			
			});
	    
       
    }
    
    /**
     * Validate instructor.
     */
    async validateInstructor(e?: Event): Promise<void> {
	    
	    var step2 = document.querySelector<HTMLElement>("#step2native");
		if(step2 != null)
			step2.style.display = "none";
				 	
	    const courseinstructor = this.instructorForm.value.courseinstructor;
	     
	    const url = "https://art001exe.exentriq.com/93489/isValidTeacher?code=" + courseinstructor + "&course=" + window["courseId"] + "&rand=" + new Date().getTime();
	    				
		fetch(url, {
			method: 'GET',
			headers: {
				'Accept': 'application/json',
				'Content-Type': 'application/json',
			}
		})
			.then(response => response.json())
			.then(data => {
				console.log("Valid ",data);
				
				if(data.valid){
					window["dataTeacher"] = data;	
					var step3 = document.querySelector<HTMLElement>("#step3native");
					if(step3 != null)
						step3.style.display = "block";
						
					var courseTeacherName = document.querySelector<HTMLInputElement>("#course-teacher-name-native");
					if(courseTeacherName != null)
						courseTeacherName.innerHTML = data.name;
						
				}else{
					CoreDomUtils.showErrorModal(Translate.instant('core.course.not_valid'));	
					if(step2 != null)
						step2.style.display = "block";
				}
			
			});
	    
       
    }
    
    /**
     * Validate instructor.
     */
    async confirmCourse(e?: Event): Promise<void> {
	    
	    var step3 = document.querySelector<HTMLElement>("#step3native");
		if(step3 != null)
			step3.style.display = "none";
				 	
	    console.log("window['dataTeacher'] ", window["dataTeacher"]);
	    
	    var teacherId = window["dataTeacher"].id;
		var teacherName = encodeURIComponent(window["dataTeacher"].name);
				
		var studentId = "";
		var verify_code_nr = document.querySelector<HTMLElement>(".verify_code_nr");
		if(verify_code_nr != null)
        	studentId = verify_code_nr.attributes["data-id"].value
		
		console.log("studentId ", studentId);
		
		var couponId = window["couponId"];
		
		console.log("couponId ", couponId);
		
		const courseCode = this.couponForm.value.coursecode;
				
		console.log("courseCode ", courseCode);
		
	    const url = "https://art001exe.exentriq.com/93489/enrol?teacherId=" + teacherId + "&teacherName=" + teacherName + "&courseId=" + window["courseId"] + "&studentId=" + studentId + "&couponId=" + couponId + "&courseCode=" + courseCode + "&rand=" + new Date().getTime();	    				
		fetch(url, {
			method: 'GET',
			headers: {
				'Accept': 'application/json',
				'Content-Type': 'application/json',
			}
		})
			.then(response => response.json())
			.then(data => {
				console.log("Valid ",data);
								
				if(data.status == "success"){
					
					var step3 = document.querySelector<HTMLElement>("#step2native");
					if(step3 != null)
						step3.style.display = "block";
									
					CoreCourseHelper.getCourse(data.courseId).then(result => {
                        
                        CoreCourseHelper.openCourse(result.course);
                        CoreUtils.ignoreErrors(CoreCourses.invalidateUserCourses());
                        
                        window["courseId"] = null;
						window["couponId"] = null;
						this.couponForm.value.coursecode = "";
						this.couponForm.get('coursecode')?.setValue("");
							
						this.instructorForm.value.courseinstructor = ""; 
						this.instructorForm.get('courseinstructor')?.setValue("");
								
						var step1 = document.querySelector<HTMLElement>("#step1native");
						if(step1 != null)
							step1.style.display = "block";
						
						var step2 = document.querySelector<HTMLElement>("#step2native");
						if(step2 != null)
							step2.style.display = "none";
						
                    });
                    
                    
							
				}else{
					CoreDomUtils.showErrorModal(Translate.instant('core.course.course_server_error'));
					
				}
			
			});
	    
       
    }
    
     async showBadgesNative(): Promise<void> {
			        
        let contentModal = await CoreDomUtils.openModal({
    		component: CoreLoginSiteBadgesComponent,
    		cssClass: 'core-modal-fullscreen',
		});
			        
	 }
    
    /**
     * Open settings.
     */
     changeCode(): void {
        window["courseId"] = null;
		window["couponId"] = null;
				
		var step1 = document.querySelector<HTMLElement>("#step1native");
		if(step1 != null)
			step1.style.display = "block";
		
		var step2 = document.querySelector<HTMLElement>("#step2native");
		if(step2 != null)
			step2.style.display = "none";
			
		var step3 = document.querySelector<HTMLElement>("#step3native");
		if(step3 != null)
			step3.style.display = "none";
		
		this.couponForm.value.coursecode = "";
		this.couponForm.get('coursecode')?.setValue("");
			
		this.instructorForm.value.courseinstructor = ""; 
		this.instructorForm.get('courseinstructor')?.setValue("");
		 	
		var invcourse = document.querySelector<HTMLElement>(".invalid-course");
		if(invcourse != null)
			invcourse.style.display = "none";
			
		var invteacher = document.querySelector<HTMLElement>(".invalid-teacher");
		if(invteacher != null)
			invteacher.style.display = "none";
			
		var courseTeacher = document.querySelector<HTMLInputElement>("#course-teacher");
		if(courseTeacher != null)
			courseTeacher.style.display = "none";
		
    }
    

}

type NewsForum = CoreCourseModuleBasicInfo & {
    handlerData?: CoreCourseModuleHandlerData;
};
