import { catchRender, mount } from "@onlycells/core";
import { App } from "./app";

mount("#app", catchRender({ render: () => <App /> }));
