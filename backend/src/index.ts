export default {
  async fetch(): Promise<Response> {
    return new Response('Hello ZenFast!', { status: 200 });
  },
};
