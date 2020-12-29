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
import { IObjectStorage } from "@paperbits/common/persistence";
import { PageContract, IPageService, PageLocalizedContract } from "@paperbits/common/pages";
import { Contract } from  "@paperbits/common/contract";
import { IBlockService } from  "@paperbits/common/blocks";
import { PageItem } from "@paperbits/core/workshops/page/ko/pageItem";
import { HttpClient } from "@paperbits/common/http";

const documentsPath = "files";
const templateBlockKey = "blocks/new-page-template";
const urlPath = "../../.env";

@Component({
    selector: "app",
    template: template
})

export class App {
    protected pagesPath: string = "pages";
    
    constructor(
        private readonly viewManager: ViewManager,
        private readonly objectStorage: IObjectStorage,
        private readonly pageService: IPageService,
        private readonly blockService: IBlockService,
        private readonly httpClient: HttpClient
    ) { }

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

        var brandWingsURL = "";
        this.httpClient.send({
            url: "/data/url.json",
            method: "GET"
        }).then(response => {
            var responseObject = response.toObject();
            brandWingsURL = responseObject['BRAND_WINGS_URL'];
        });

        window.addEventListener("message", (event) => {
            if(event.origin != brandWingsURL) {
                return;
            }
            var eData = event.data;
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
                    var key = object.id
                    this.viewManager.setHost({ name: "layout-host", params: { layoutKey: key } });
                    break;
                case "page":
                    this.openPageObject(object.id, object.title, object.language, object.content)
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
}