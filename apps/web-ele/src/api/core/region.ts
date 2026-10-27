import { baseRequestClient } from '#/api/request';

/** 行政区划响应（对应后端 RegionOut） */
export interface RegionItem {
  id: number;
  code: string;
  level: number;
  name: string;
  parent_id: null | number;
}

interface RegionPageQuery {
  page?: number;
  page_size?: number;
}

/** 市级列表查询参数 */
export interface CitiesListQuery extends RegionPageQuery {
  province_id?: null | number;
}

/** 区/县级列表查询参数 */
export interface DistrictsListQuery extends RegionPageQuery {
  city_id?: null | number;
  province_id?: null | number;
}

/** region 后端的统一响应结构，成功时 code 为 200 */
interface RegionApiResponse<T> {
  code: number;
  message: string;
  data: null | T;
}

interface RegionPageData {
  items: RegionItem[];
  page: number;
  page_size: number;
  total: number;
}

/** baseRequestClient 返回原始响应（含 data/status），对齐运行时结构 */
interface RawResponse<T> {
  data: T;
  status: number;
}

const REGION_API_PREFIX = '/v1/regions';

/**
 * 请求行政区划列表。
 *
 * 注意：这里使用 baseRequestClient（无拦截器），因为 region 后端的
 * 成功 code 是 200，而全局 requestClient 按 code === 0 判定成功。
 */
async function fetchRegionList<TQuery extends RegionPageQuery>(
  url: string,
  query: TQuery,
): Promise<RegionItem[]> {
  const response = await baseRequestClient.post<
    RawResponse<RegionApiResponse<RegionPageData>>
  >(url, { page: 1, page_size: 100, ...query });
  const body = response.data;
  if (body.code !== 200 || !body.data) {
    throw new Error(body.message || '行政区划接口请求失败');
  }
  return body.data.items;
}

/** 分页查询省级列表 */
export async function getProvincesApi(query: RegionPageQuery = {}) {
  return fetchRegionList(`${REGION_API_PREFIX}/provinces/list`, query);
}

/** 分页查询指定省（province_id）下的市级列表 */
export async function getCitiesApi(query: CitiesListQuery = {}) {
  return fetchRegionList(`${REGION_API_PREFIX}/cities/list`, query);
}

/** 分页查询区/县级列表：传 city_id 查该市下，传 province_id 跨市查全省下 */
export async function getDistrictsApi(query: DistrictsListQuery = {}) {
  return fetchRegionList(`${REGION_API_PREFIX}/districts/list`, query);
}
