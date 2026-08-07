type Env = {
  PUBLIC_XANO_API_URL?: string;
};

export const onRequestGet: PagesFunction<Env> = async ({ params, request }) => {
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const url = new URL(request.url);
  const locale = url.searchParams.get("lang");
  url.pathname = "/dashboard/cars/promote";
  url.search = "";

  if (id) {
    url.searchParams.set("id", String(id));
  }
  if (locale) {
    url.searchParams.set("lang", locale);
  }

  return Response.redirect(url.toString(), 302);
};
