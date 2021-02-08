/**
 * @license
 * Copyright Paperbits. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file and at https://paperbits.io/license/mit.
 */

import template from "./app.html";
import { ViewManager, View } from "@paperbits/common/ui";
import { Component, OnMounted } from "@paperbits/common/ko/decorators";
import { IObjectStorage, Query } from "@paperbits/common/persistence";
import { PageContract, IPageService, PageLocalizedContract } from "@paperbits/common/pages";
import { LayoutContract, ILayoutService, LayoutLocalizedContract } from "@paperbits/common/layouts";
import { Contract } from  "@paperbits/common/contract";
import { IBlockService } from  "@paperbits/common/blocks";
import { PageItem } from "@paperbits/core/workshops/page/ko/pageItem";
import { HttpClient } from "@paperbits/common/http";
import { IMediaService, MediaContract } from "@paperbits/common/media";
import { LayoutItem } from "@paperbits/core/workshops/layout/ko";
import { layoutTemplate } from "@paperbits/common/layouts/layoutTemplate";
import { IPublisher } from "@paperbits/common/publishing";
import { InversifyInjector } from "@paperbits/common/injection";
import { EventManager } from "@paperbits/common/events";

const documentsPath = "files";
const templateBlockKey = "blocks/new-page-template";
const urlPath = "../../.env";

@Component({
    selector: "app",
    template: template
})

export class App {
    protected pagesPath: string = "pages";
    protected layoutsPath: string = "layouts";
    private brandWingsURL = "";
    private currentObject = {};
    
    constructor(
        private readonly viewManager: ViewManager,
        private readonly objectStorage: IObjectStorage,
        private readonly pageService: IPageService,
        private readonly blockService: IBlockService,
        private readonly httpClient: HttpClient,
        private readonly mediaService: IMediaService,
        private readonly layoutService: ILayoutService,
        private readonly eventManager: EventManager
    ) { 
        eventManager.addEventListener("onSaveChanges", async () => {
            var document = viewManager.getHostDocument();
            var sendObject = {
                type: this.currentObject['type'],
                id: this.currentObject['id'],
                html: document.documentElement.innerHTML
            }
            window.parent.postMessage({
                    "message": "builder.saveHTML",
                    "object": sendObject
                }, this.brandWingsURL)
        });
    }

    @OnMounted()
    public async initialize(): Promise<void> {
        var params = new Array();
        if(window.location.search) {
            var paramsString = window.location.search.split("?")[1];
            var paramValues = paramsString.split("&");
            paramValues.forEach(param => {
                var paramValue = param.split("=");
                params[paramValue[0]] = paramValue[1];
            });
        }

        this.viewManager.setHost({ name: "page-host" });

        this.httpClient.send({
            url: "/data/url.json",
            method: "GET"
        }).then(response => {
            var responseObject = response.toObject();
            this.brandWingsURL = responseObject['BRAND_WINGS_URL'];
        });

        window.addEventListener("message", (event) => {
            if(event.origin != this.brandWingsURL) {
                return;
            }
            var eData = event.data;
            this.currentObject = eData;
            this.openObject(eData);
        }, false);
    }

    public openObject(object) {
        if(object.type) {
            switch (object.type) {
                case "style":
                    this.viewManager.setHost({ name: "style-guide" });
                    break;
                case "layout":
                    this.loadImageList(object.imagesList);
                    this.loadMenuList(object.menusList);
                    this.openLayoutObject(object.id, object.name, object.markup);
                    break;
                case "page":
                    this.loadImageList(object.imagesList);
                    this.openPageObject(object.id, object.title, object.language, object.markup)
                    break;
                case "images": 
                    this.loadImageList(object);
                    break;
                default:
                    break;
            }
        }
    }

    public async openPageObject(pageId: string, pageTitle: string, requestedLocale: string, content: string): Promise<void> {
        let pageObject = await this.pageService.getPageByKey(pageId);

        const pageUrl = "/pages/" + pageId;
        if(!pageObject) {
            pageObject = await this.createPage(pageUrl, pageTitle, "", "", pageId, requestedLocale, content)
        }

        const pageItem = new PageItem(pageObject);

        const view: View = {
            heading: "Page",
            component: {
                name: "page-details-workshop",
                params: {
                    pageItem: pageItem,
                }
            }
        };

        this.viewManager.openViewAsWorkshop(view);
    }

    public async createPage(permalink: string, title: string, description: string, keywords: string, identifier: string, locale: string, content: string): Promise<PageContract> {
        const pageKey = `${this.pagesPath}/${identifier}`;
        const contentKey = `${documentsPath}/${identifier}`;

        const localizedPage: PageLocalizedContract = {
            key: pageKey,
            locales: {
                [locale]: {
                    title: title,
                    description: description,
                    keywords: keywords,
                    permalink: permalink,
                    contentKey: contentKey
                }
            }
        };

        
        await this.objectStorage.addObject<PageLocalizedContract>(pageKey, localizedPage);
        
        let template;
        if(content && content != '') {
            template = {
                nodes: JSON.parse(content),
                type: "page",
                key: contentKey
            }
        } else {
            template = await this.blockService.getBlockContent(templateBlockKey);
            template["key"] = contentKey;
        }
        await this.objectStorage.addObject<Contract>(contentKey, template);
        
        const pageContent: PageContract = {
            key: pageKey,
            title: title,
            description: description,
            keywords: keywords,
            permalink: permalink,
            contentKey: contentKey
        };

        return pageContent;
    }

    public async openLayoutObject(layoutId: string, layoutName: string, layoutContent: string) {
        let layoutObject = await this.layoutService.getLayoutByKey(layoutId)

        if(!layoutObject) {
            const layoutUrlTemplate = "/" + layoutId;
            layoutObject = await this.createLayout(layoutName, "", layoutUrlTemplate, layoutId, layoutContent);
        }
        const layoutItem = new LayoutItem(layoutObject);

        const view: View = {
            heading: "Layout",
            component: {
                name: "layout-details-workshop",
                params: {
                    layoutItem: layoutItem
                }
            }
        };

        this.viewManager.openViewAsWorkshop(view);
    }

    public async createLayout(title: string, description: string, permalinkTemplate: string, identifier: string, content: string): Promise<LayoutContract> {
        const layoutKey = `${this.layoutsPath}/${identifier}`;
        const contentKey = `${documentsPath}/${identifier}`;

        const localizedLayout: LayoutLocalizedContract = {
            key: layoutKey,
            locales: {
                ['en-us']: {
                    title: title,
                    description: description,
                    permalinkTemplate: permalinkTemplate,
                    contentKey: contentKey
                }
            }
        };

        await this.objectStorage.addObject<LayoutLocalizedContract>(layoutKey, localizedLayout);
        let layoutNewTemplate;
        if(content && content != '') {
            layoutNewTemplate = {
                nodes: JSON.parse(content),
                type: "layout"
            }
        } else {
            layoutNewTemplate = layoutTemplate;
        }
        await this.objectStorage.addObject<Contract>(contentKey, layoutNewTemplate);

        const layoutContent: LayoutContract = {
            key: layoutKey,
            title: title,
            description: description,
            permalinkTemplate: permalinkTemplate,
            contentKey: contentKey
        };

        return layoutContent;
    }

    public async loadImageList(imagesList) {
        const query = Query
            .from<MediaContract>()
            .orderBy(`fileName`);
        this.mediaService.search(query)
            .then(response => {
                response.value.forEach(element => {
                    this.mediaService.deleteMedia(element)
                });
                Object.values(imagesList).forEach(image => {
                    const media: MediaContract = {
                        key: image["key"],
                        fileName: image["fileName"],
                        blobKey: undefined,
                        downloadUrl: image["downloadUrl"],
                        description: "",
                        keywords: "",
                        permalink: image["permalink"],
                        mimeType: image["mimeType"]
                    };
                    this.objectStorage.addObject(media.key, media);
                });
            })
    }

    public async loadMenuList(menusList) {
        this.objectStorage.deleteObject('navigationItems')
            .then(() => {
                this.objectStorage.addObject('navigationItems', menusList);
            })
    }

    public publishSite() {
       
       const injector = new InversifyInjector(); 
       const publisher = injector.resolve<IPublisher>("sitePublisher");

        /* Running actual publishing */
        publisher.publish()
            .then(() => {
                console.log("DONE.");
                process.exit();
            })
            .catch((error) => {
                console.log(error);
                process.exit();
            });
    }
}