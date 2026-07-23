export class APIClient {
    baseURL;
    token;
    workspaceId;
    constructor(baseURL, token, workspaceId) {
        this.baseURL = baseURL;
        this.token = token;
        this.workspaceId = workspaceId;
    }
    async request(method, path, body) {
        const headers = {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.token}`,
        };
        if (this.workspaceId)
            headers["X-Workspace-ID"] = this.workspaceId;
        const res = await fetch(this.baseURL + path, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`HTTP ${res.status}: ${text}`);
        }
        if (res.status === 204)
            return undefined;
        return res.json();
    }
    getJSON(path) {
        return this.request("GET", path);
    }
    postJSON(path, body) {
        return this.request("POST", path, body);
    }
    deleteJSON(path) {
        return this.request("DELETE", path);
    }
    patchJSON(path, body) {
        return this.request("PATCH", path, body);
    }
    putJSON(path, body) {
        return this.request("PUT", path, body);
    }
    async postMultipart(path, form) {
        const headers = {
            Authorization: `Bearer ${this.token}`,
        };
        if (this.workspaceId)
            headers["X-Workspace-ID"] = this.workspaceId;
        const res = await fetch(this.baseURL + path, {
            method: "POST",
            headers,
            body: form,
        });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`HTTP ${res.status}: ${text}`);
        }
        if (res.status === 204)
            return undefined;
        return res.json();
    }
    async getText(path) {
        const headers = {
            Authorization: `Bearer ${this.token}`,
        };
        if (this.workspaceId)
            headers["X-Workspace-ID"] = this.workspaceId;
        const res = await fetch(this.baseURL + path, { method: "GET", headers });
        if (!res.ok) {
            const text = await res.text();
            throw new Error(`HTTP ${res.status}: ${text}`);
        }
        return res.text();
    }
    async healthCheck() {
        try {
            await this.getJSON("/health");
            return true;
        }
        catch {
            return false;
        }
    }
}
