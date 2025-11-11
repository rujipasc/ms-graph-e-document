import { graphRequest } from "../integrations/graphRequest.js";
import { getEmployeeInfo } from "../core/db/dbHelper.js";

const GRAPH_BASE = "https://graph.microsoft.com/v1.0";

export const getUserByEmployeeId = async (empID) => {
    let graphError;

    try {
        const url = `${GRAPH_BASE}/users?$filter=employeeId eq '${empID}'&$select=id,employeeId,displayName,mail,userPrincipalName`;
        const data = await graphRequest("get", url);
        const user = data.value?.[0];
        if (user) return user;
    } catch (error) {
        graphError = error;
    }

    try {
        const employee = await getEmployeeInfo(empID);
        const displayName = [employee.FIRST_NAME_TH, employee.LAST_NAME_TH]
            .filter(Boolean)
            .join(" ")
            .trim() || String(empID);

        return {
            id: null,
            employeeId: employee.EMPLOYEE_ID ?? String(empID),
            displayName,
            mail: null,
            userPrincipalName: null,
        };
    } catch (dbError) {
        const graphMsg = graphError ? ` Graph error: ${graphError.message};` : "";
        throw new Error(
            `Failed to get user by employee ID: ${empID}:${graphMsg} MySQL error: ${dbError.message}`
        );
    }
};

const result = await getUserByEmployeeId('20245728');
console.log(result);
