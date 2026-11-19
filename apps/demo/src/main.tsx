import { catchRender, mount } from "@nodiffjs/core";
import { App } from "./app";

mount("#app", catchRender({ render: () => <App /> }));
