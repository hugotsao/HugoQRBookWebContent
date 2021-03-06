import { Injectable } from '@angular/core';
import { Article, Category, Content } from './data-structures';
import { HttpClient } from '@angular/common/http'
import { Observable, of, forkJoin } from 'rxjs';
import { map, switchMap, filter, skipWhile } from 'rxjs/operators';
import { HttpHeaders } from '@angular/common/http';
import { shareReplay } from 'rxjs/operators';


@Injectable({
  providedIn: 'root'
})
export class DataStoreService {
  api = "http://localhost:8080/api";
  sessionToken: string ="";
  authenticated: boolean = false;
  httpHeaders =  new HttpHeaders({
      'Content-Type':  'application/json'
    });
  constructor(
    private httpClient: HttpClient
  ) {
  }

  fetchCategories(): Observable<Category[]> {
    return this.httpClient.get<Category[]>(`${this.api}/categories/get`).pipe(
      shareReplay(1)
    );
  }

  fetchArticles(): Observable<Article[]> {
    return this.httpClient.get<Article[]>(`${this.api}/articles/get`).pipe(
      shareReplay(1)
    );
  }

  fetchContent(id: string): Observable<Content> {
    if (id === 'new') {
      return of({content: ''} as Content);
    }
    return this.getArticleFromId(id).pipe(
      switchMap(article => article === null ? of({content: ''} as Content) : this.httpClient.get<Content>(`${this.api}/content/${article.articleId}/get`)),
      shareReplay(1)
      )      
  }

  createOrUpdateContent(formdata: any){
    let article: Article = formdata.article;
    let contentObj: Content = formdata.content;
    const today: Date = new Date();
    if (article.publishDate){
      const content: Content = { 
        articleId: article.articleId,
        content: contentObj.content
      }
      article = {
        ...article,
        modifiedDate: today
      }
      this.httpClient.put<Article>(`${this.api}/article/update`, article, {headers: this.httpHeaders}).subscribe();
      this.httpClient.put<Content>(`${this.api}/content/update`, content, {headers: this.httpHeaders}).subscribe();
    } else {
      article = {
        ...article,
        publishDate: today,
        modifiedDate: today
      }
      this.httpClient.post<Article>(`${this.api}/article/add`, article, {headers: this.httpHeaders})
        .subscribe(article => {
          const content: Content = {
            articleId: article.articleId,
            content: contentObj.content
          }
        this.httpClient.post<Content>(`${this.api}/content/add`, content, {headers: this.httpHeaders}).subscribe();
      })
    }
    
 }
  getArticleFromId(articleId: string): Observable<Article> {
    if (articleId === 'new') {
      return of({title: '', categoryId: ''} as Article);
    }
   return this.httpClient.get<Article>(`${this.api}/article/${articleId}/get`)
  }
  
  getLeftPanel(): Observable<Map<string, Article[]>> {
    const tableOfContent: Map<string, Article[]> = new Map();
    return forkJoin([this.fetchCategories(), this.fetchArticles()]).pipe(
      map(([categories, articles]) => {       
        articles.map(article => {
          const keyCategory = categories.find(category => article.categoryId === category.categoryId);
          if(keyCategory) {
            if(!tableOfContent.has(keyCategory.categoryName)){
              tableOfContent.set(keyCategory.categoryName, []);
            }
            tableOfContent.get(keyCategory.categoryName).push(article);
          }
        })
        return tableOfContent;
      }),
      shareReplay(1)
    )
  }

  getDisplayContent(articleId: string): Observable<[Article, Content]> {
    return forkJoin([this.getArticleFromId(articleId), this.fetchContent(articleId)])
      .pipe(shareReplay(1))
  }

  authenticate(credentials, callback) {
    
    const authenticationRequest = {
      username: credentials.username,
      password: credentials.password
    }

    this.httpClient.post(`${this.api}/authentication`, authenticationRequest, {headers: this.httpHeaders})
    .subscribe(response => {
        if (response['token']) {
          this.httpHeaders = this.httpHeaders.set('authorization', `Bearer ${response['token']}`)
          this.authenticated = true;
        } else {
            this.authenticated = false;
        }
        return callback && callback();
    });

}
}
