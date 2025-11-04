import { graphRequest } from "../integrations/graphRequest.js";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

export const getUserByEmployeeId = async (empID) => {
    try {
        const url = `${GRAPH_BASE}/users?$filter=employeeId eq '${empID}'&$select=id,employeeId,displayName,mail,userPrincipalName`
        const data = await graphRequest("get", url);
        return data.value[0] || null;
    } catch (error) {
        throw new Error(`Failed to get user by employee ID: ${empID}: ${error.message}`)
    }
}; 

